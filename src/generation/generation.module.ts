import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GenerationService } from './generation.service';
import { LlmClient } from './llm.client';
import { PromptBuilder } from './prompt.builder';

@Module({
  /**
   * The plan takes minutes, not seconds. A thirteen-section Spanish crisis plan
   * measured 116s for a single attempt and a longer one exceeded 180s outright,
   * which surfaced as a bare 500 — a request that was going to succeed,
   * abandoned. Five minutes per attempt, overridable.
   *
   * This is also the strongest argument for backgrounding generation the way
   * Sustaining Recovery does: three attempts at this length is a long time for a
   * parent to watch a spinner. Milestone 2.
   */
  imports: [
    HttpModule.register({
      timeout: Number(process.env.OPENAI_TIMEOUT_MS ?? 300000),
    }),
  ],
  providers: [GenerationService, PromptBuilder, LlmClient],
  exports: [GenerationService],
})
export class GenerationModule {}
