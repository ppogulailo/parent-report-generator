import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_ES,
  buildUserPrompt,
  getSectionHeaders,
} from '../prompts';
import { ReportSections } from '../interfaces/report.interface';
import type { Language } from '../dto/generate-report.dto';

/** Thrown when generation failed in a way that is worth retrying (OpenAI 429
 *  rate limit, or a stream that ended before the model signalled completion). */
export class RetryableGenerationError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('retryable-generation-error');
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** OpenAI 429 bodies say "Please try again in 48.616s". Honour that hint,
 *  capped, so we wait long enough for the TPM window to free up. */
function parseRetryMs(body: string, fallback = 5000): number {
  const m = body.match(/try again in ([\d.]+)\s*s/i);
  const ms = m ? Math.ceil(parseFloat(m[1]) * 1000) : fallback;
  return Math.min(Math.max(ms, 1000), 60000);
}

@Injectable()
export class ClaudeService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  // gpt-4o-mini was too small for this rule-dense prompt — it produced
  // degenerate fragments and leaked prompt scaffolding. gpt-4.1 follows the
  // dense instruction set (banned-phrase lists, verbatim sequences) most
  // strictly of the OpenAI models.
  // gpt-4.1 is rate-limited to 30k TPM on the current OpenAI tier — too small for
  // this ~30k-token prompt. gpt-5.1 (500k TPM) runs it and follows the dense
  // rule-set at least as well. Reasoning model → use max_completion_tokens.
  private readonly model = 'gpt-5.1';
  // The full 8-section plan with its verbatim sequences runs long; 2000 was
  // truncating reports mid-section. 8192 is a ceiling, not a target.
  private readonly maxTokens = 8192;
  // Each report is ~27k tokens; on a tight OpenAI TPM tier, back-to-back
  // requests get 429'd. Retry honouring OpenAI's suggested wait so a throttle
  // becomes a slower success instead of a truncated, corrupted report.
  private readonly maxRetries = 3;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');
    this.apiUrl = this.configService.get<string>(
      'OPENAI_API_URL',
      'https://api.openai.com/v1/chat/completions',
    );
  }

  private systemFor(language: Language): string {
    return language === 'es' ? SYSTEM_PROMPT_ES : SYSTEM_PROMPT;
  }

  async generateReport(
    domainScores: Record<string, number>,
    topDomains: string[],
    responses?: number[],
    language: Language = 'en',
    crisis?: string,
  ): Promise<ReportSections> {
    const userPrompt = buildUserPrompt(
      domainScores,
      topDomains,
      responses,
      language,
      crisis,
    );

    const text = await this.complete(this.systemFor(language), userPrompt);
    return this.parseSections(text, language);
  }

  /**
   * Report-type-agnostic completion: POST a (system, user) message pair to the
   * OpenAI Chat Completions endpoint and return the assistant text. Honours the
   * 429 retry policy. Used by both the intervention plan (above) and the
   * Sustaining Recovery plan, which supply their own prompts and parse the
   * returned text against their own section headers.
   */
  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(
            this.apiUrl,
            {
              model: this.model,
              max_completion_tokens: this.maxTokens,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            },
            {
              headers: {
                authorization: `Bearer ${this.apiKey}`,
                'content-type': 'application/json',
              },
            },
          ),
        );

        const text: string = response.data.choices[0].message.content;
        return text;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 429 && attempt <= this.maxRetries) {
          const data = (err as { response?: { data?: unknown } })?.response
            ?.data;
          const body = typeof data === 'string' ? data : JSON.stringify(data);
          await sleep(parseRetryMs(body));
          continue;
        }
        throw new InternalServerErrorException(
          'Report generation failed. Please try again.',
        );
      }
    }
  }

  async *generateReportStream(
    domainScores: Record<string, number>,
    topDomains: string[],
    responses?: number[],
    language: Language = 'en',
    crisis?: string,
  ): AsyncGenerator<string, void, void> {
    const userPrompt = buildUserPrompt(
      domainScores,
      topDomains,
      responses,
      language,
      crisis,
    );

    yield* this.completeStream(this.systemFor(language), userPrompt);
  }

  /**
   * Report-type-agnostic streaming completion. Streams assistant text deltas
   * for a (system, user) message pair, retrying 429s before the first token
   * (transparent to the caller) and throwing {@link RetryableGenerationError}
   * if the stream ends without the model signalling completion.
   */
  async *completeStream(
    systemPrompt: string,
    userPrompt: string,
  ): AsyncGenerator<string, void, void> {
    const requestBody = JSON.stringify({
      model: this.model,
      max_completion_tokens: this.maxTokens,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    // Pre-flight: a 429 here happens BEFORE any text is yielded, so retrying is
    // fully transparent to the client (it just waits longer for the first token).
    let response: globalThis.Response;
    for (let attempt = 1; ; attempt++) {
      response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: requestBody,
      });
      if (response.status === 429 && attempt <= this.maxRetries) {
        const errBody = await response.text().catch(() => '');
        await sleep(parseRetryMs(errBody));
        continue;
      }
      break;
    }

    if (!response.ok || !response.body) {
      throw new InternalServerErrorException(
        'Report generation failed. Please try again.',
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;

    try {
      while (true) {
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
            return;
          }
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
            if (parsed.choices?.[0]?.finish_reason === 'stop') completed = true;
          } catch {
            /* ignore malformed SSE chunks */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Stream ended without the model signalling completion (dropped connection,
    // mid-stream throttle). The partial text already streamed is incomplete —
    // signal a retry so the caller can reset and regenerate from scratch.
    if (!completed) {
      throw new RetryableGenerationError(2000);
    }
  }

  private parseSections(text: string, language: Language): ReportSections {
    const headers = getSectionHeaders(language);
    const [
      urgentConcern,
      headlineSummary,
      topImmediatePriorities,
      keyPriorities,
      whatToAvoid,
      first72Hours,
      days4to7,
      consideringInpatient,
      encouragement,
    ] = headers;

    const extract = (label: string): string => {
      // Escape regex metachars in header labels (Spanish headers include dashes).
      const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `${esc}\\s*\\n([\\s\\S]*?)(?=\\n[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9\\s&—-]+\\n|$)`,
        'i',
      );
      const match = text.match(pattern);
      return match ? match[1].trim() : '';
    };

    return {
      urgentConcern: extract(urgentConcern),
      headlineSummary: extract(headlineSummary),
      topImmediatePriorities: extract(topImmediatePriorities),
      keyPriorities: extract(keyPriorities),
      whatToAvoid: extract(whatToAvoid),
      first72Hours: extract(first72Hours),
      days4to7: extract(days4to7),
      consideringInpatient: extract(consideringInpatient),
      encouragement: extract(encouragement),
    };
  }
}
