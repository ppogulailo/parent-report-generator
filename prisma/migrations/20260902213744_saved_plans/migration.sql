-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'es');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('generating', 'complete', 'failed');

-- CreateTable
CREATE TABLE "Submission" (
    "id" UUID NOT NULL,
    "assessmentVersion" TEXT NOT NULL,
    "matrixVersion" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'en',
    "responses" JSONB NOT NULL,
    "urgentTextEncrypted" TEXT,
    "scrubbedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'generating',
    "language" "Language" NOT NULL,
    "severity" JSONB NOT NULL,
    "sections" JSONB,
    "renderedHtml" TEXT,
    "warnings" TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmExchange" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "modelId" TEXT NOT NULL,
    "requestBody" JSONB NOT NULL,
    "responseBody" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreSnapshot" (
    "id" UUID NOT NULL,
    "tierId" TEXT NOT NULL,
    "domainScores" JSONB NOT NULL,
    "language" "Language" NOT NULL,
    "assessmentVersion" TEXT NOT NULL,
    "matrixVersion" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Submission_createdAt_idx" ON "Submission"("createdAt");

-- CreateIndex
CREATE INDEX "Plan_submissionId_createdAt_idx" ON "Plan"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "Plan_createdAt_idx" ON "Plan"("createdAt");

-- CreateIndex
CREATE INDEX "LlmExchange_planId_createdAt_idx" ON "LlmExchange"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmExchange_createdAt_idx" ON "LlmExchange"("createdAt");

-- CreateIndex
CREATE INDEX "ScoreSnapshot_createdAt_idx" ON "ScoreSnapshot"("createdAt");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmExchange" ADD CONSTRAINT "LlmExchange_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
