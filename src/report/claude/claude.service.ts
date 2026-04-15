import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts';
import { ReportSections } from '../interfaces/report.interface';

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

  async generateReport(
    domainScores: Record<string, number>,
    topDomains: string[],
  ): Promise<ReportSections> {
    const userPrompt = buildUserPrompt(domainScores, topDomains);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            model: this.model,
            max_tokens: 2000,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
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
      return this.parseSections(text);
    } catch {
      throw new InternalServerErrorException(
        'Report generation failed. Please try again.',
      );
    }
  }

  private parseSections(text: string): ReportSections {
    const extract = (label: string): string => {
      const pattern = new RegExp(
        `${label}\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z0-9\\s&]+\\n|$)`,
        'i',
      );
      const match = text.match(pattern);
      return match ? match[1].trim() : '';
    };

    return {
      headlineSummary: extract('HEADLINE SUMMARY'),
      keyPriorities:   extract('KEY PRIORITIES'),
      whatToAvoid:     extract('WHAT TO AVOID'),
      next7Days:       extract('NEXT 7 DAYS ACTION PLAN'),
      encouragement:   extract('ENCOURAGEMENT & DIRECTION'),
    };
  }
}
