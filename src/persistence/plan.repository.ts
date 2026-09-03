import { Injectable } from '@nestjs/common';
// `Prisma` is a value import as well as a type one: clearing a Json column
// needs `Prisma.DbNull` at runtime — a plain `null` means "JSON null" to
// Prisma, not "SQL NULL".
import { Prisma } from '@prisma/client';
import type { Language, Plan, PlanStatus } from '@prisma/client';
import { FieldEncryptionService } from './field-encryption.service';
import { PrismaService } from './prisma.service';

/**
 * The only place that reads or writes saved-plan rows.
 *
 * Encryption lives behind this boundary: callers pass and receive plaintext
 * and never see the `*Encrypted` column — same rule, for the same reason, as
 * the Sustaining Recovery FRAAP this mirrors. Input types are structural, not
 * imported from selection or generation, so persistence stays a leaf.
 */

export interface CreateSubmissionInput {
  assessmentVersion: string;
  matrixVersion: string;
  methodologyVersion: string;
  language: Language;
  /** Keyed by question id, e.g. `{ q01: 3 }`. */
  responses: Record<string, number>;
  /** Plaintext. Encrypted before it reaches the database. */
  urgentText?: string | null;
}

export interface SeveritySnapshot {
  tierId: string;
  tierLabel: string;
  tierDescription: string;
  /** Keyed by domain id — labels are applied at read time from content. */
  domainScores: Record<string, number>;
  topDomains: string[];
  audit: unknown;
}

export interface LogExchangeInput {
  planId: string;
  attempt: number;
  modelId: string;
  requestBody: unknown;
  responseBody?: unknown;
  errorMessage?: string | null;
}

export interface PlanWithSubmission {
  plan: Plan;
  submission: {
    id: string;
    language: Language;
    createdAt: Date;
    scrubbedAt: Date | null;
  };
}

@Injectable()
export class PlanRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
  ) {}

  async createSubmission(input: CreateSubmissionInput): Promise<{ id: string }> {
    const row = await this.prisma.submission.create({
      data: {
        assessmentVersion: input.assessmentVersion,
        matrixVersion: input.matrixVersion,
        methodologyVersion: input.methodologyVersion,
        language: input.language,
        responses: input.responses,
        urgentTextEncrypted: this.encryption.encrypt(input.urgentText),
      },
      select: { id: true },
    });
    return row;
  }

  async createPlan(input: {
    submissionId: string;
    language: Language;
    severity: SeveritySnapshot;
  }): Promise<{ id: string }> {
    return this.prisma.plan.create({
      data: {
        submissionId: input.submissionId,
        language: input.language,
        severity: input.severity as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  }

  async completePlan(
    planId: string,
    input: {
      sections: unknown;
      renderedHtml: string;
      warnings: string[];
      attempts: number;
    },
  ): Promise<void> {
    await this.prisma.plan.update({
      where: { id: planId },
      data: {
        status: 'complete',
        sections: input.sections as Prisma.InputJsonValue,
        renderedHtml: input.renderedHtml,
        warnings: input.warnings,
        attempts: input.attempts,
        completedAt: new Date(),
      },
    });
  }

  async failPlan(planId: string, reason: string): Promise<void> {
    await this.prisma.plan.update({
      where: { id: planId },
      data: {
        status: 'failed',
        // Opaque wording only — a failure reason can quote model output, which
        // contains what the family submitted, so callers pass a category, not
        // the error.
        failureReason: reason,
        sections: Prisma.DbNull,
      },
    });
  }

  async logExchange(input: LogExchangeInput): Promise<void> {
    await this.prisma.llmExchange.create({
      data: {
        planId: input.planId,
        attempt: input.attempt,
        modelId: input.modelId,
        requestBody: input.requestBody as Prisma.InputJsonValue,
        responseBody:
          input.responseBody === undefined
            ? Prisma.DbNull
            : (input.responseBody as Prisma.InputJsonValue),
        errorMessage: input.errorMessage ?? null,
      },
    });
  }

  async findPlan(planId: string): Promise<PlanWithSubmission | null> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        submission: {
          select: {
            id: true,
            language: true,
            createdAt: true,
            scrubbedAt: true,
          },
        },
      },
    });
    if (!plan) return null;
    const { submission, ...rest } = plan;
    return { plan: rest as Plan, submission };
  }

  /**
   * Parent-requested deletion: the whole graph, immediately. Keyed by the plan
   * id — the same capability the return link carries — and deletes the
   * SUBMISSION, so every plan, answer and generation record for that family
   * goes together. The de-identified snapshot has no key to find, which is the
   * point of its design.
   */
  async deleteEverythingForPlan(planId: string): Promise<boolean> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { submissionId: true },
    });
    if (!plan) return false;
    await this.prisma.submission.delete({ where: { id: plan.submissionId } });
    return true;
  }

  /** De-identified, keyless, kept forever. Written at submit time. */
  async saveSnapshot(input: {
    tierId: string;
    domainScores: Record<string, number>;
    language: Language;
    assessmentVersion: string;
    matrixVersion: string;
    methodologyVersion: string;
  }): Promise<void> {
    await this.prisma.scoreSnapshot.create({
      data: {
        ...input,
        domainScores: input.domainScores as Prisma.InputJsonValue,
      },
    });
  }
}

export type { Plan, PlanStatus };
