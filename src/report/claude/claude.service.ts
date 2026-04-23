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

@Injectable()
export class ClaudeService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model = 'gpt-4o-mini';

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
  ): Promise<ReportSections> {
    const userPrompt = buildUserPrompt(
      domainScores,
      topDomains,
      responses,
      language,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            model: this.model,
            max_tokens: 2000,
            messages: [
              { role: 'system', content: this.systemFor(language) },
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
      return this.parseSections(text, language);
    } catch {
      throw new InternalServerErrorException(
        'Report generation failed. Please try again.',
      );
    }
  }

  async *generateReportStream(
    domainScores: Record<string, number>,
    topDomains: string[],
    responses?: number[],
    language: Language = 'en',
  ): AsyncGenerator<string, void, void> {
    const userPrompt = buildUserPrompt(
      domainScores,
      topDomains,
      responses,
      language,
    );

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2000,
        stream: true,
        messages: [
          { role: 'system', content: this.systemFor(language) },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok || !response.body) {
      throw new InternalServerErrorException(
        'Report generation failed. Please try again.',
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            /* ignore malformed SSE chunks */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseSections(text: string, language: Language): ReportSections {
    const headers = getSectionHeaders(language);
    const [
      headlineSummary,
      topImmediatePriorities,
      keyPriorities,
      whatToAvoid,
      first72Hours,
      days4to7,
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
      headlineSummary: extract(headlineSummary),
      topImmediatePriorities: extract(topImmediatePriorities),
      keyPriorities: extract(keyPriorities),
      whatToAvoid: extract(whatToAvoid),
      first72Hours: extract(first72Hours),
      days4to7: extract(days4to7),
      encouragement: extract(encouragement),
    };
  }
}
