import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ContentService } from '../content/content.service';
import type { Language } from '../content/content.types';
import type { ReportSectionConfig } from '../content/schemas/sections.schema';
import { evaluate } from '../selection/rule.evaluator';
import type { SelectionResult } from '../selection/selection.types';
import { LlmClient, LlmTurn, RetryableLlmError } from './llm.client';
import { PromptBuilder } from './prompt.builder';
import { parsePartialJson } from './partial-json';
import { buildReportSchema } from './report-schema';
import {
  checkAnswerLabels,
  checkBannedTitles,
  checkRequiredWording,
  checkUnselectedResources,
  checkVoice,
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

/** What the streaming generator emits while a plan is being written. */
export type GenerationEvent =
  | {
      /** Everything the matrix decided, available before the model is called. */
      type: 'decided';
      tierId: string;
      tierLabel: string;
      tierDescription: string;
      domainScores: Record<string, number>;
      topDomains: string[];
      /**
       * The plan's shape, drawn before a word of it exists.
       *
       * `text` is present on static sections — that copy is the platform's and
       * needs no model, so the guiding principles and the standardized closing
       * appear in full immediately rather than as placeholders.
       */
      outline: {
        key: string;
        order: number;
        type: string;
        title: string;
        text?: string;
      }[];
      /** Priority areas in the matrix's order, with the names it gave them. */
      recommendations: { recommendationId: string; title: string }[];
      /** The selected workshops, with their links, ready to render at once. */
      workshops: {
        workshopId: string;
        title: string;
        category: string;
        url: string | null;
      }[];
    }
  | {
      /** Sections finished so far. Progress only — never authoritative. */
      type: 'partial';
      sections: Record<string, unknown>;
    }
  | {
      /** The previous attempt broke a rule and is being written again. The UI
       *  should discard what it has: the next attempt starts from nothing. */
      type: 'revising';
      attempt: number;
    }
  | { type: 'report'; report: GeneratedReport };

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
    const sections = this.sectionsFor(selection);

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
      // A parent sees the standard try-again message. The reason is in the log
      // above and must not travel any further: `lastProblems` quotes the model's
      // own output back, which can contain the family's answers.
      throw new ServiceUnavailableException(
        'Report generation failed. Please try again.',
      );
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

  /**
   * The same pipeline, streamed.
   *
   * Emits the matrix's decision immediately — scores, severity, the plan's
   * outline — because none of that needs the model, and a parent should reach
   * their results screen at once rather than watching a spinner for a minute.
   * Then the sections as they finish, then the validated report.
   *
   * Validation and retries are unchanged. A stream that ends in a rule violation
   * is discarded and rewritten, and the UI is told to drop what it has: a
   * half-written attempt that broke a rule must not be what a parent keeps.
   */
  async *generateStream(
    selection: SelectionResult,
    language: Language,
    urgentText?: string | null,
  ): AsyncGenerator<GenerationEvent> {
    const sections = this.sectionsFor(selection);
    const tier = this.content.tier(selection.tierId);

    yield {
      type: 'decided',
      tierId: selection.tierId,
      tierLabel: tier.label[language],
      tierDescription: tier.description[language],
      domainScores: Object.fromEntries(
        Object.entries(selection.scored.domainScores).map(([id, score]) => [
          this.content.domainLabel(id, language),
          score,
        ]),
      ),
      topDomains: selection.scored.topDomains.map((id) =>
        this.content.domainLabel(id, language),
      ),
      outline: sections.map((section) => ({
        key: section.key,
        order: section.order,
        type: section.type,
        title: section.title[language],
        ...(section.type === 'static'
          ? { text: section.text?.[language] ?? '' }
          : {}),
      })),
      recommendations: [
        selection.primary.id,
        ...selection.supporting.map((supporting) => supporting.id),
      ].map((id) => ({
        recommendationId: id,
        title: this.content.recommendation(id).title[language],
      })),
      workshops: selection.workshopIds.map((id) => {
        const workshop = this.content.workshop(id);
        return {
          workshopId: id,
          title: workshop.title,
          category:
            this.content.workshops.categoryLabels[workshop.category][language],
          url: workshop.url,
        };
      }),
    };

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

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      if (attempt > 1) yield { type: 'revising', attempt };

      // Collected by the stream callback and drained between reads, because a
      // callback cannot yield from a generator.
      const pending: Record<string, unknown>[] = [];
      let raw: string;
      try {
        raw = await this.llm.streamJson(messages, (accumulated) => {
          const progress = parsePartialJson(accumulated);
          if (Object.keys(progress).length > 0) pending.push(progress);
        });
      } catch (err) {
        if (err instanceof RetryableLlmError && attempt < this.maxAttempts) {
          this.logger.warn(
            `stream unusable (attempt ${attempt}/${this.maxAttempts}); retrying`,
          );
          continue;
        }
        throw err;
      }

      // Only the last snapshot matters — the earlier ones are prefixes of it.
      const latest = pending[pending.length - 1];
      if (latest) yield { type: 'partial', sections: latest };

      const problems = this.problemsWith(raw, schema, selection, language);
      if (problems.length === 0) {
        const report = schema.parse(JSON.parse(raw));
        yield {
          type: 'report',
          report: this.assemble(
            report,
            sections,
            selection,
            language,
            [],
            attempt,
          ),
        };
        return;
      }

      lastProblems = problems;
      this.logger.warn(
        `attempt ${attempt}/${this.maxAttempts} rejected: ${problems.length} problem(s) — ${problems[0]}`,
      );

      const candidate = safeJson(raw);
      if (candidate && schema.safeParse(candidate).success) parsed = candidate;

      if (attempt === this.maxAttempts) break;
      messages.push({ role: 'assistant', content: raw });
      messages.push({ role: 'user', content: correctionFor(problems) });
    }

    if (!parsed) {
      this.logger.error(
        `generation failed after ${this.maxAttempts} attempts: ${lastProblems.join(' | ')}`,
      );
      throw new ServiceUnavailableException(
        'Report generation failed. Please try again.',
      );
    }

    this.logger.error(
      `SHIPPING WITH VIOLATIONS after ${this.maxAttempts} attempts — ${lastProblems.join(' | ')}`,
    );
    yield {
      type: 'report',
      report: this.assemble(
        parsed,
        sections,
        selection,
        language,
        lastProblems,
        this.maxAttempts,
      ),
    };
  }

  /** Everything wrong with a raw response: shape first, then prose. */
  private problemsWith(
    raw: string,
    schema: ReturnType<typeof buildReportSchema>['schema'],
    selection: SelectionResult,
    language: Language,
  ): string[] {
    const candidate = safeJson(raw);
    if (!candidate) {
      return [
        'Your response was not valid JSON. Return one JSON object and nothing else — no markdown fence, no commentary.',
      ];
    }
    const result = schema.safeParse(candidate);
    if (!result.success) {
      return result.error.issues.map(
        (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      );
    }
    return this.proseProblems(result.data, selection, language).map(
      (violation) => `${violation.ruleId}: ${violation.detail}`,
    );
  }

  /**
   * The sections that apply to one report, conditionals and tier gating
   * resolved.
   *
   * A workshop list with no workshops is a heading with nothing under it. It
   * happens when no routing rule fired a workshop, and the model cannot fix it —
   * an empty array is the correct answer to "write about exactly these zero
   * workshops". Dropping it here means the model is never asked for it either.
   */
  private sectionsFor(selection: SelectionResult): ReportSectionConfig[] {
    return this.content
      .sectionsFor(selection.tierId, (section) =>
        section.when ? evaluate(section.when, selection.scored) : true,
      )
      .filter(
        (section) =>
          section.type !== 'workshopList' || selection.workshopIds.length > 0,
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
      ...checkVoice(
        report,
        this.content.voiceRulesFor(selection.tierId),
        this.content.workshops,
        language,
      ),
      ...(this.content.voice.answerLabelQuoting.enabled
        ? checkAnswerLabels(
            report,
            this.chosenLabels(selection, language),
            this.content.voice.answerLabelQuoting.minWords,
          )
        : []),
    ];
  }

  /** The option labels this parent actually selected, for the answer-label check.
   *  Only their own answers matter: a label they did not choose appearing in the
   *  prose is a different problem, and not one this rule is about. */
  private chosenLabels(
    selection: SelectionResult,
    language: Language,
  ): string[] {
    return this.content.assessment.questions
      .map((question) => {
        const value = selection.scored.normalisedResponses[question.id];
        return question.options.find((option) => option.value === value)?.label[
          language
        ];
      })
      .filter((label): label is string => label !== undefined);
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

/** Parses without throwing. Used where a failure is an expected outcome rather
 *  than an error — a model returning prose is a case to feed back, not a crash. */
function safeJson(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * The correction fed back to the model.
 *
 * Stated in the validator's own terms, which works far better than repeating the
 * original instruction louder.
 */
function correctionFor(problems: string[]): string {
  return [
    'That response was rejected. Fix exactly these problems and return the complete JSON object again:',
    '',
    ...problems.map((problem) => `- ${problem}`),
    '',
    'Change nothing else. Keep every other section as you wrote it.',
  ].join('\n');
}
