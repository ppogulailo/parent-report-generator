import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Posts to the OpenAI chat completions endpoint and returns the assistant text.
 *
 * Named for what it is. The existing `ClaudeService` in this repo is named for
 * Anthropic but posts to OpenAI, which has misled every reader of it; the same
 * mistake is not repeated here.
 *
 * Raw `HttpService` rather than a vendor SDK, matching the repo's convention.
 *
 * **Error strings must never contain prompt content, model output, or anything
 * the parent submitted.** They reach logs and, through the exception filter, a
 * browser. The generation service is the only thing that sees model text.
 */

/** Thrown when the failure is worth retrying — a rate limit, or a response that
 *  stopped before the model finished. */
export class RetryableLlmError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('retryable-llm-error');
    this.name = 'RetryableLlmError';
  }
}

/** A 429, carrying the wait the provider asked for. Internal to this file: the
 *  caller sees either a successful stream or a plain failure. */
class RateLimited extends Error {
  constructor(public readonly waitMs: number) {
    super('rate-limited');
    this.name = 'RateLimited';
  }
}

/**
 * Whether a 429 means "slow down" or "the account is out of credit".
 *
 * OpenAI returns both as 429, and they need opposite handling: a throttle is
 * worth waiting out, an exhausted balance never resolves. Retrying the second
 * one spent fifteen seconds of a parent's time before failing anyway — found
 * when this project's own test key ran dry.
 */
function isOutOfCredit(body: string): boolean {
  return (
    body.includes('insufficient_quota') ||
    body.includes('credit_balance_exhausted') ||
    body.includes('exceeded your current quota')
  );
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** OpenAI 429 bodies say "Please try again in 48.616s". Honour the hint, capped,
 *  so a throttle becomes a slower success rather than a failed report. */
function parseRetryMs(body: string, fallback = 5000): number {
  const match = body.match(/try again in ([\d.]+)\s*s/i);
  const ms = match ? Math.ceil(parseFloat(match[1]) * 1000) : fallback;
  return Math.min(Math.max(ms, 1000), 60000);
}

export interface LlmTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;

  /** For the generation-record audit trail — never for choosing behaviour. */
  get modelId(): string {
    return this.model;
  }

  /** The plan runs long across fourteen sections. A ceiling, not a target. */
  private readonly maxTokens = 8192;
  private readonly maxRateLimitRetries = 3;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Fail at boot, not at a parent's first request.
    this.apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');
    this.apiUrl = this.configService.get<string>(
      'OPENAI_API_URL',
      'https://api.openai.com/v1/chat/completions',
    );
    // Matches the live system, so the upgrade changes the architecture without
    // also changing the model underneath it — one variable at a time.
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-5.1');
  }

  /**
   * Streams a JSON object, calling `onText` with the accumulated text as it
   * arrives, and returning the whole thing once the stream closes.
   *
   * The stream exists so a parent watches their plan being written instead of a
   * spinner for a minute. It is progress only: the caller still validates the
   * finished text, because a partial parse must never decide anything.
   *
   * Uses `fetch` rather than `HttpService`, because Axios buffers the whole
   * response body before resolving — which would deliver the entire stream at
   * once and defeat the purpose.
   */
  async streamJson(
    messages: LlmTurn[],
    onText: (accumulated: string) => void,
  ): Promise<string> {
    // Rate limits are retried here exactly as they are on the non-streaming
    // path. They were not, at first, and a throttle killed the stream outright
    // while the plain endpoint recovered from the same 429 — a real run found
    // it. A parent must not lose their plan because the previous request was
    // recent.
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.streamOnce(messages, onText);
      } catch (err) {
        if (err instanceof RateLimited && attempt <= this.maxRateLimitRetries) {
          this.logger.warn(
            `rate limited mid-stream (attempt ${attempt}/${this.maxRateLimitRetries}); waiting ${err.waitMs}ms`,
          );
          await sleep(err.waitMs);
          continue;
        }
        if (err instanceof RateLimited) {
          this.logger.error('rate limited and out of retries');
          throw new InternalServerErrorException(
            'Report generation failed. Please try again.',
          );
        }
        throw err;
      }
    }
  }

  private async streamOnce(
    messages: LlmTurn[],
    onText: (accumulated: string) => void,
  ): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: this.model,
        max_completion_tokens: this.maxTokens,
        response_format: { type: 'json_object' },
        stream: true,
        messages,
      }),
    });

    if (response.status === 429) {
      const body = await response.text().catch(() => '');
      if (isOutOfCredit(body)) {
        // Not a throttle. Waiting changes nothing, and this needs to be obvious
        // in the logs rather than looking like traffic.
        this.logger.error(
          'the model API reports no remaining credit — this is a billing problem, not a rate limit',
        );
        throw new InternalServerErrorException(
          'Report generation failed. Please try again.',
        );
      }
      // OpenAI states the wait in the body; honour it rather than guessing.
      throw new RateLimited(parseRetryMs(body));
    }

    if (!response.ok || !response.body) {
      this.logger.error(
        `streaming generation request failed with status ${response.status}`,
      );
      throw new InternalServerErrorException(
        'Report generation failed. Please try again.',
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let completed = false;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            completed = true;
            continue;
          }
          try {
            const parsed = JSON.parse(data) as {
              choices?: {
                delta?: { content?: string };
                finish_reason?: string | null;
              }[];
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              text += delta;
              onText(text);
            }
            if (parsed.choices?.[0]?.finish_reason === 'stop') completed = true;
            if (parsed.choices?.[0]?.finish_reason === 'length') {
              // Truncated: the JSON cannot be parsed and half a plan is worse
              // than a retry.
              throw new RetryableLlmError(1000);
            }
          } catch (err) {
            if (err instanceof RetryableLlmError) throw err;
            // A malformed SSE frame is not worth failing the whole stream over.
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // The stream ended without the model signalling completion — a dropped
    // connection or a mid-stream throttle. What arrived is incomplete.
    if (!completed || text.trim().length === 0) {
      throw new RetryableLlmError(2000);
    }

    return text;
  }

  /**
   * Requests a JSON object. `response_format` is what makes the schema check a
   * validation step rather than a parsing gamble — without it a model that
   * wraps its answer in prose or a markdown fence fails for a reason that has
   * nothing to do with the methodology.
   */
  async completeJson(messages: LlmTurn[]): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.post<{
            choices: {
              message: { content: string };
              finish_reason?: string;
            }[];
          }>(
            this.apiUrl,
            {
              model: this.model,
              max_completion_tokens: this.maxTokens,
              response_format: { type: 'json_object' },
              messages,
            },
            {
              headers: {
                authorization: `Bearer ${this.apiKey}`,
                'content-type': 'application/json',
              },
            },
          ),
        );

        const choice = response.data.choices[0];
        if (choice?.finish_reason === 'length') {
          // Truncated JSON cannot be parsed, and half a plan is worse than a
          // retry. Retryable because a second attempt often lands shorter.
          throw new RetryableLlmError(1000);
        }

        const text = choice?.message?.content;
        if (typeof text !== 'string' || text.trim().length === 0) {
          throw new RetryableLlmError(1000);
        }
        return text;
      } catch (err: unknown) {
        if (err instanceof RetryableLlmError) throw err;

        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 429) {
          const data = (err as { response?: { data?: unknown } })?.response
            ?.data;
          const body = typeof data === 'string' ? data : JSON.stringify(data);

          if (isOutOfCredit(body)) {
            this.logger.error(
              'the model API reports no remaining credit — this is a billing problem, not a rate limit',
            );
            throw new InternalServerErrorException(
              'Report generation failed. Please try again.',
            );
          }

          if (attempt <= this.maxRateLimitRetries) {
            const wait = parseRetryMs(body);
            this.logger.warn(
              `rate limited (attempt ${attempt}/${this.maxRateLimitRetries}); waiting ${wait}ms`,
            );
            await sleep(wait);
            continue;
          }
        }

        // Deliberately opaque. The status is logged; nothing from the prompt,
        // the response, or the submission goes into the message.
        this.logger.error(
          `generation request failed${status ? ` with status ${status}` : ''}`,
        );
        throw new InternalServerErrorException(
          'Report generation failed. Please try again.',
        );
      }
    }
  }
}
