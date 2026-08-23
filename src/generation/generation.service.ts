import { Injectable, Logger } from '@nestjs/common';
import { ContentService } from '../content/content.service';
import type { Language } from '../content/content.types';
import type { ReportSectionConfig } from '../content/schemas/sections.schema';
import { evaluate } from '../selection/rule.evaluator';
import type { SelectionResult } from '../selection/selection.types';
import { LlmClient, LlmTurn, RetryableLlmError } from './llm.client';
import { PromptBuilder } from './prompt.builder';
import { buildReportSchema } from './report-schema';
import {
  checkBannedTitles,
  checkRequiredWording,
  checkUnselectedResources,
  WordingViolation,
} from './voice-rules';

/**
 * Generates the report: prompt, validate, retry, assemble.
 *
 * The loop is the point. A response that adds, drops or renames a
 * recommendation or workshop fails the schema; a response missing required
 * wording fails the prose checks; either way the error is fed back and the model
 * tries again. The methodology is not requested and hoped for, it is required.
 *
 * If every attempt fails, the report **still ships**, with the failures recorded
 * as warnings. Losing a parent's whole plan over a wording rule is the worse
 * outcome — but shipping silently would be worse still, so the warnings are
 * logged loudly and returned to the caller.
 */

export interface RenderedSection {
  key: string;
  order: number;
  type: ReportSectionConfig['type'];
  title: string;
  /** Prose sections. */
  body?: string;
  /** List sections. */
  items?: string[];
  /** Priority areas, in the matrix's order. */
  recommendations?: {
    recommendationId: string;
    title: string;
    headline: string;
    body: string;
  }[];
  /** Workshops, with the link a parent follows — null until ASAP supplies it. */
  workshops?: {
    workshopId: string;
    title: string;
    category: string;
    url: string | null;
    whyThisFamily: string;
  }[];
}

export interface GeneratedReport {
  sections: RenderedSection[];
  language: Language;
  tierId: string;
  tierLabel: string;
  matrixVersion: string;
  methodologyVersion: string;
  /** Empty on a clean generation. Non-empty means the report shipped with a
   *  known rule violation, which someone should see. */
  warnings: string[];
  attempts: number;
}

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  /** Two retries after the first attempt. Beyond that the model is not going to
   *  find it, and a parent is waiting. */
  private readonly maxAttempts = 3;

  constructor(
    private readonly content: ContentService,
    private readonly prompts: PromptBuilder,
    private readonly llm: LlmClient,
  ) {}

  async generate(
    selection: SelectionResult,
    language: Language,
    urgentText?: string | null,
  ): Promise<GeneratedReport> {
    const sections = this.content.sectionsFor(selection.tierId, (section) =>
      section.when ? evaluate(section.when, selection.scored) : true,
    );

    const { schema } = buildReportSchema(sections, selection);

    const messages: LlmTurn[] = [
      { role: 'system', content: this.prompts.system(language) },
      {
        role: 'user',
        content: this.prompts.user(selection, sections, language, urgentText),
      },
    ];

    let lastProblems: string[] = [];
    let parsed: Record<string, unknown> | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      attempts = attempt;

      let raw: string;
      try {
        raw = await this.llm.completeJson(messages);
      } catch (err) {
        if (err instanceof RetryableLlmError && attempt < this.maxAttempts) {
          this.logger.warn(
            `response unusable (attempt ${attempt}/${this.maxAttempts}); retrying`,
          );
          continue;
        }
        throw err;
      }

      const problems: string[] = [];

      let candidate: unknown;
      try {
        candidate = JSON.parse(raw);
      } catch {
        problems.push(
          'Your response was not valid JSON. Return one JSON object and nothing else — no markdown fence, no commentary.',
        );
      }

      if (problems.length === 0) {
        const result = schema.safeParse(candidate);
        if (result.success) {
          const report = result.data;
          problems.push(
            ...this.proseProblems(report, selection, language).map(
              (v) => `${v.ruleId}: ${v.detail}`,
            ),
          );
          if (problems.length === 0) {
            return this.assemble(
              report,
              sections,
              selection,
              language,
              [],
              attempt,
            );
          }
          parsed = report;
        } else {
          problems.push(
            ...result.error.issues.map(
              (issue) =>
                `${issue.path.join('.') || '(root)'}: ${issue.message}`,
            ),
          );
        }
      }

      lastProblems = problems;
      this.logger.warn(
        `attempt ${attempt}/${this.maxAttempts} rejected: ${problems.length} problem(s) — ${problems[0]}`,
      );

      if (attempt === this.maxAttempts) break;

      // Feed the failure back. The model is told what was wrong in the terms the
      // validator used, which is far more effective than repeating the original
      // instruction louder.
      messages.push({ role: 'assistant', content: raw });
      messages.push({
        role: 'user',
        content: [
          'That response was rejected. Fix exactly these problems and return the complete JSON object again:',
          '',
          ...problems.map((p) => `- ${p}`),
          '',
          'Change nothing else. Keep every other section as you wrote it.',
        ].join('\n'),
      });
    }

    // Exhausted. If we have a structurally valid report that only failed the
    // prose checks, ship it with the warnings attached — a plan with a wording
    // problem beats no plan. If we never got a valid structure, that is a
    // failure the parent must not be handed.
    if (!parsed) {
      this.logger.error(
        `generation failed after ${this.maxAttempts} attempts: ${lastProblems.join(' | ')}`,
      );
      throw new RetryableLlmError(0);
    }

    this.logger.error(
      `SHIPPING WITH VIOLATIONS after ${this.maxAttempts} attempts — ${lastProblems.join(' | ')}`,
    );
    return this.assemble(
      parsed,
      sections,
      selection,
      language,
      lastProblems,
      attempts,
    );
  }

  /** The checks that read the finished prose rather than its shape. */
  private proseProblems(
    report: Record<string, unknown>,
    selection: SelectionResult,
    language: Language,
  ): WordingViolation[] {
    return [
      ...checkRequiredWording(
        report,
        this.content.requiredWordingFor(selection.tierId),
        language,
      ),
      ...checkBannedTitles(report, this.content.workshops),
      ...checkUnselectedResources(
        report,
        this.content.workshops,
        selection.workshopIds,
        selection.discussionGroupIds,
        this.content.requiredWordingFor(selection.tierId),
      ),
    ];
  }

  /**
   * Merges what the model wrote with what the platform owns.
   *
   * Static sections are inserted here, from content, in their configured
   * position. The model never saw them and cannot have altered them — that is
   * what makes the Universal Guiding Principles and the standardized closing a
   * guarantee rather than an instruction.
   */
  private assemble(
    report: Record<string, unknown>,
    sections: ReportSectionConfig[],
    selection: SelectionResult,
    language: Language,
    warnings: string[],
    attempts: number,
  ): GeneratedReport {
    const rendered: RenderedSection[] = sections.map((section) => {
      const base = {
        key: section.key,
        order: section.order,
        type: section.type,
        title: section.title[language],
      };

      if (section.type === 'static') {
        return { ...base, body: section.text?.[language] ?? '' };
      }

      const value = report[section.key];

      if (section.type === 'prose') {
        return { ...base, body: typeof value === 'string' ? value : '' };
      }

      if (section.type === 'list') {
        return {
          ...base,
          items: Array.isArray(value) ? (value as string[]) : [],
        };
      }

      if (section.type === 'recommendationList') {
        const written = (value ?? []) as {
          recommendationId: string;
          headline: string;
          body: string;
        }[];
        // Reordered to the matrix's ranking rather than the model's ordering.
        // The schema accepts any order, because a right set in a wrong order is
        // not a methodology error — but the parent reads them in the order the
        // methodology ranked them.
        const order = [
          selection.primary.id,
          ...selection.supporting.map((s) => s.id),
        ];
        return {
          ...base,
          recommendations: order
            .map((id) => {
              const item = written.find((w) => w.recommendationId === id);
              if (!item) return null;
              return {
                recommendationId: id,
                title: this.content.recommendation(id).title[language],
                headline: item.headline,
                body: item.body,
              };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null),
        };
      }

      // workshopList
      const written = (value ?? []) as {
        workshopId: string;
        whyThisFamily: string;
      }[];
      return {
        ...base,
        workshops: selection.workshopIds
          .map((id) => {
            const item = written.find((w) => w.workshopId === id);
            if (!item) return null;
            const workshop = this.content.workshop(id);
            return {
              workshopId: id,
              title: workshop.title,
              category:
                this.content.workshops.categoryLabels[workshop.category][
                  language
                ],
              // Null until ASAP supplies the Circle URLs. The renderer shows
              // the title unlinked rather than an empty link.
              url: workshop.url,
              whyThisFamily: item.whyThisFamily,
            };
          })
          .filter((w): w is NonNullable<typeof w> => w !== null),
      };
    });

    return {
      sections: rendered,
      language,
      tierId: selection.tierId,
      tierLabel: this.content.tier(selection.tierId).label[language],
      matrixVersion: selection.matrixVersion,
      methodologyVersion: selection.methodologyVersion,
      warnings,
      attempts,
    };
  }
}
