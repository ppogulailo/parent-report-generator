import { Global, Module } from '@nestjs/common';
import { ContentService } from './content.service';

/**
 * Global so every layer can read content without threading the service through
 * module imports. There is exactly one bundle per process and it never changes
 * after boot, so a single shared instance is the honest representation.
 */
@Global()
@Module({
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
