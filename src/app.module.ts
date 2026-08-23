import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssessmentModule } from './assessment/assessment.module';
import { ContentModule } from './content/content.module';
import { HealthModule } from './health/health.module';
import { ReportModule } from './report/report.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global, and imported first: it loads and validates `content/` in its
    // constructor, so a broken routing rule stops the app before anything else
    // initialises.
    ContentModule,
    HealthModule,
    // The Version 1.0 pipeline.
    AssessmentModule,
    // The pre-existing endpoint, still serving the live frontend until it
    // migrates. Remove once it has.
    ReportModule,
  ],
})
export class AppModule {}
