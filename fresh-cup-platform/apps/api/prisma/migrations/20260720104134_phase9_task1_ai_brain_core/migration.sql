-- CreateEnum
CREATE TYPE "AiInsightType" AS ENUM ('REASONING', 'PATTERN', 'ANOMALY', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "AiRecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED');

-- CreateEnum
CREATE TYPE "AiPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "type" "AiInsightType" NOT NULL DEFAULT 'REASONING',
    "category" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_memories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "memory_type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "priority" "AiPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "AiRecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_decisions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "decision_type" TEXT NOT NULL,
    "priority" "AiPriority" NOT NULL DEFAULT 'MEDIUM',
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_learning_events" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "feedback" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_insights_organization_id_branch_id_created_at_idx" ON "ai_insights"("organization_id", "branch_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_insights_organization_id_category_idx" ON "ai_insights"("organization_id", "category");

-- CreateIndex
CREATE INDEX "ai_memories_organization_id_branch_id_importance_idx" ON "ai_memories"("organization_id", "branch_id", "importance");

-- CreateIndex
CREATE INDEX "ai_memories_organization_id_memory_type_idx" ON "ai_memories"("organization_id", "memory_type");

-- CreateIndex
CREATE INDEX "ai_recommendations_organization_id_branch_id_status_idx" ON "ai_recommendations"("organization_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "ai_recommendations_organization_id_priority_idx" ON "ai_recommendations"("organization_id", "priority");

-- CreateIndex
CREATE INDEX "ai_decisions_organization_id_created_at_idx" ON "ai_decisions"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_decisions_organization_id_priority_idx" ON "ai_decisions"("organization_id", "priority");

-- CreateIndex
CREATE INDEX "ai_learning_events_recommendation_id_idx" ON "ai_learning_events"("recommendation_id");

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decisions" ADD CONSTRAINT "ai_decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_learning_events" ADD CONSTRAINT "ai_learning_events_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "ai_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
