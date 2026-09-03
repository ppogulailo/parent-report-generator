import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client as a Nest provider — deliberately NOT fail-fast.
 *
 * Saved plans are a bonus on top of the assessment, and the product predates
 * them: a missing DATABASE_URL or an unreachable database must degrade to
 * "plans are generated unsaved", never to "no parent can take the assessment".
 * That is a different trade than the Sustaining Recovery FRAAP makes, because
 * there the database IS the product's memory; here it arrived in Milestone 5.
 *
 * Query logging is deliberately off. Prisma's `query` log level prints bound
 * parameters, which for this app means a parent's answers and their urgent
 * note would land in stdout. `warn` and `error` only.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  readonly configured = Boolean(process.env.DATABASE_URL);

  constructor() {
    super({
      log: ['warn', 'error'],
      // Prisma throws at construction when DATABASE_URL is absent. A dummy
      // datasource keeps DI alive; every query then fails at call time, where
      // the repositories and PlanService already treat failure as "unsaved".
      ...(process.env.DATABASE_URL
        ? {}
        : {
            datasources: {
              db: { url: 'postgresql://unconfigured@localhost:5432/unconfigured' },
            },
          }),
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.configured) {
      this.logger.warn(
        'DATABASE_URL is not set — plans will be generated but not saved, and no return link will be offered',
      );
      return;
    }
    try {
      await this.$connect();
      this.logger.log('database connected');
    } catch (err) {
      this.logger.error(
        `database unreachable at boot — plans will be generated unsaved until it returns: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect().catch(() => undefined);
  }
}
