import { Global, Module } from '@nestjs/common';
import { FieldEncryptionService } from './field-encryption.service';
import { PlanRepository } from './plan.repository';
import { PrismaService } from './prisma.service';
import { RetentionService } from './retention.service';

@Global()
@Module({
  providers: [
    PrismaService,
    FieldEncryptionService,
    PlanRepository,
    RetentionService,
  ],
  exports: [PrismaService, FieldEncryptionService, PlanRepository],
})
export class PersistenceModule {}
