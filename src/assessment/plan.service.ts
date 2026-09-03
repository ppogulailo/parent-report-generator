import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Language } from '@prisma/client';
import { ContentService } from '../content/content.service';
import type {
  ExchangeListener,
  GeneratedReport,
} from '../generation/generation.service';
import {
  PlanRepository,
  type SeveritySnapshot,
} from '../persistence/plan.repository';
import { RetentionService } from '../persistence/retention.service';
import { PlanRenderer } from '../render/plan.renderer';
import type { SelectionResult } from '../selection/selection.types';

/**
 * Saved plans (Milestone 5): persistence wrapped AROUND the assessment flow,
 * never inside it.
 *
 * Every write here is fail-soft. A parent whose plan cannot be saved still
 * gets their plan — the generation result goes to the browser regardless, and
 * the failure is logged. The return link is a bonus on top of the product, and
 * a database blip must not turn into a family losing their report.
 */

export interface PersistedStart {
  submissionId: string;
  planId: string;
}

export interface PlanView {
  status: 'generating' | 'complete' | 'failed';
  language: Language;
  severity: { tierId: string; label: string; description: string };
  domainScores: Record<string, number>;
  topDomains: string[];
  sections: unknown | null;
  audit: unknown;
  createdAt: string;
  /** When the 90-day clock deletes this plan. Shown to the parent, not hidden
   *  in a policy page. */
  expiresAt: string;
}

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    private readonly repository: PlanRepository,
    private readonly renderer: PlanRenderer,
    private readonly content: ContentService,
  ) {}

  /**
   * Called before generation: stores the submission (urgent text encrypted),
   * the de-identified snapshot, and the plan shell the return link points at.
   */
  async persistStart(input: {
    responses: Record<string, number>;
    urgentText?: string | null;
    language: Language;
    selection: SelectionResult;
  }): Promise<PersistedStart | null> {
    try {
      const { matrix, assessment } = this.content;
      const tier = this.content.tier(input.selection.tierId);

      const versions = {
        assessmentVersion: assessment.version,
        matrixVersion: matrix.version,
        methodologyVersion: matrix.methodologyVersion,
      };

      const submission = await this.repository.createSubmission({
        ...versions,
        language: input.language,
        responses: input.responses,
        urgentText: input.urgentText,
      });

      await this.repository.saveSnapshot({
        ...versions,
        tierId: input.selection.tierId,
        domainScores: input.selection.scored.domainScores,
        language: input.language,
      });

      const severity: SeveritySnapshot = {
        tierId: input.selection.tierId,
        tierLabel: tier.label[input.language],
        tierDescription: tier.description[input.language],
        domainScores: input.selection.scored.domainScores,
        topDomains: input.selection.scored.topDomains,
        audit: input.selection.audit,
      };

      const plan = await this.repository.createPlan({
        submissionId: submission.id,
        language: input.language,
        severity,
      });

      return { submissionId: submission.id, planId: plan.id };
    } catch (err) {
      this.logger.error(
        `could not persist submission — the plan will be generated unsaved: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /** A listener that swallows its own failures — generation never waits on
   *  record-keeping, and never dies of it. */
  exchangeListener(planId: string | undefined): ExchangeListener | undefined {
    if (!planId) return undefined;
    return (exchange) => {
      void this.repository
        .logExchange({ planId, ...exchange })
        .catch((err: unknown) =>
          this.logger.debug(
            `exchange log dropped: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    };
  }

  async persistComplete(
    planId: string,
    report: GeneratedReport,
  ): Promise<void> {
    try {
      const found = await this.repository.findPlan(planId);
      const severity = found?.plan.severity as unknown as
        | SeveritySnapshot
        | undefined;
      const html = this.renderer.renderDocument({
        planId,
        language: report.language,
        tierId: report.tierId,
        tierLabel: report.tierLabel,
        tierDescription: this.content.tier(report.tierId).description[
          report.language
        ],
        domainScores: Object.entries(severity?.domainScores ?? {}).map(
          ([id, score]) => ({
            label: this.content.domainLabel(id, report.language),
            score,
          }),
        ),
        sections: report.sections,
        createdAt: found?.plan.createdAt ?? new Date(),
      });
      await this.repository.completePlan(planId, {
        sections: report.sections,
        renderedHtml: html,
        warnings: report.warnings,
        attempts: report.attempts,
      });
    } catch (err) {
      this.logger.error(
        `could not persist the completed plan ${planId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async persistFailure(planId: string, category: string): Promise<void> {
    try {
      await this.repository.failPlan(planId, category);
    } catch {
      /* the staleness cutoff in view() resolves it */
    }
  }

  /** What the return link serves. */
  async view(planId: string): Promise<PlanView> {
    const found = await this.repository.findPlan(planId);
    if (!found) throw new NotFoundException('Not found.');

    const { plan, submission } = found;
    const severity = plan.severity as unknown as SeveritySnapshot;

    // A plan stuck in `generating` past any plausible generation is a crashed
    // process, and the parent deserves an answer, not a spinner.
    const stale =
      plan.status === 'generating' &&
      Date.now() - plan.createdAt.getTime() > 10 * 60 * 1000;

    return {
      status: stale ? 'failed' : plan.status,
      language: plan.language,
      severity: {
        tierId: severity.tierId,
        label: severity.tierLabel,
        description: severity.tierDescription,
      },
      // Labels applied at read time, so the response matches the submit
      // response's shape exactly and the frontend renders both identically.
      domainScores: Object.fromEntries(
        Object.entries(severity.domainScores).map(([id, score]) => [
          this.content.domainLabel(id, plan.language),
          score,
        ]),
      ),
      topDomains: severity.topDomains.map((id) =>
        this.content.domainLabel(id, plan.language),
      ),
      sections: plan.status === 'complete' ? plan.sections : null,
      audit: severity.audit,
      createdAt: plan.createdAt.toISOString(),
      expiresAt: new Date(
        submission.createdAt.getTime() +
          RetentionService.PLAN_DAYS * 86_400_000,
      ).toISOString(),
    };
  }

  async html(planId: string): Promise<{ html: string; language: Language }> {
    const found = await this.repository.findPlan(planId);
    if (!found?.plan.renderedHtml) {
      throw new NotFoundException('Not found.');
    }
    return { html: found.plan.renderedHtml, language: found.plan.language };
  }

  async delete(planId: string): Promise<void> {
    const deleted = await this.repository.deleteEverythingForPlan(planId);
    if (!deleted) throw new NotFoundException('Not found.');
    this.logger.log(`parent-requested deletion completed for plan ${planId}`);
  }
}
