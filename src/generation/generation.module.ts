import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GenerationService } from './generation.service';
import { LlmClient } from './llm.client';
import { PromptBuilder } from './prompt.builder';

@Module({
  // The plan takes tens of seconds to write. The default timeout would abandon
  // a request that was going to succeed.
  imports: [HttpModule.register({ timeout: 180000 })],
  providers: [GenerationService, PromptBuilder, LlmClient],
  exports: [GenerationService],
})
export class GenerationModule {}
