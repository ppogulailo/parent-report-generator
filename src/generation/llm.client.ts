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
        if (status === 429 && attempt <= this.maxRateLimitRetries) {
          const data = (err as { response?: { data?: unknown } })?.response
            ?.data;
          const body = typeof data === 'string' ? data : JSON.stringify(data);
          const wait = parseRetryMs(body);
          this.logger.warn(
            `rate limited (attempt ${attempt}/${this.maxRateLimitRetries}); waiting ${wait}ms`,
          );
          await sleep(wait);
          continue;
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
