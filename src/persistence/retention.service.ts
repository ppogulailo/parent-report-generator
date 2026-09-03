import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * The client-approved retention policy (Matt, 2026-09-02), enforced:
 *
 *   · 30 days — the parent's answers, the urgent note, and the generation
 *     records. Submissions are SCRUBBED at 30 days (answers emptied, urgent
 *     text nulled) rather than deleted, because the plan hangs off the row and
 *     is promised 90. Exchange rows are deleted outright.
 *   · 90 days — the plan, and with it the whole graph: the submission row is
 *     deleted and the cascade takes plans and any remaining records.
 *   · Forever — ScoreSnapshot only, which carries no key back to a family.
 *   · Immediately — on parent request, via PlanRepository, not here.
 *
 * Runs at boot and then twice a day. Every operation is an idempotent
 * bulk-delete or bulk-update bounded by a cutoff, so two machines running the
 * sweep concurrently do the same work twice, harmlessly — which is why there
 * is no leader election here.
 *
 * A plain interval rather than @nestjs/schedule: one dependency fewer, and
 * this app needs a sweep, not a scheduler.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  static readonly ANSWER_DAYS = 30;
  static readonly PLAN_DAYS = 90;
  private static readonly SWEEP_INTERVAL_MS = 12 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // First sweep shortly after boot rather than during it — a deploy should
    // come healthy before it starts deleting.
    this.timer = setInterval(() => {
      void this.sweep();
    }, RetentionService.SWEEP_INTERVAL_MS);
    setTimeout(() => void this.sweep(), 30_000).unref?.();
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  static cutoff(days: number, now = new Date()): Date {
    return new Date(now.getTime() - days * 86_400_000);
  }

  async sweep(now = new Date()): Promise<{
    exchangesDeleted: number;
    submissionsScrubbed: number;
    submissionsDeleted: number;
  }> {
    try {
      const thirty = RetentionService.cutoff(RetentionService.ANSWER_DAYS, now);
      const ninety = RetentionService.cutoff(RetentionService.PLAN_DAYS, now);

      const exchanges = await this.prisma.llmExchange.deleteMany({
        where: { createdAt: { lt: thirty } },
      });

      const scrubbed = await this.prisma.submission.updateMany({
        where: { createdAt: { lt: thirty }, scrubbedAt: null },
        data: {
          responses: {},
          urgentTextEncrypted: null,
          scrubbedAt: now,
        },
      });

      const deleted = await this.prisma.submission.deleteMany({
        where: { createdAt: { lt: ninety } },
      });

      if (exchanges.count || scrubbed.count || deleted.count) {
        this.logger.log(
          `retention sweep: ${exchanges.count} generation record(s) deleted, ` +
            `${scrubbed.count} submission(s) scrubbed at ${RetentionService.ANSWER_DAYS}d, ` +
            `${deleted.count} submission(s) deleted at ${RetentionService.PLAN_DAYS}d`,
        );
      }
      return {
        exchangesDeleted: exchanges.count,
        submissionsScrubbed: scrubbed.count,
        submissionsDeleted: deleted.count,
      };
    } catch (err) {
      // A failed sweep must never take the assessment down; the next sweep
      // covers the same ground.
      this.logger.error(
        `retention sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { exchangesDeleted: 0, submissionsScrubbed: 0, submissionsDeleted: 0 };
    }
  }
}
