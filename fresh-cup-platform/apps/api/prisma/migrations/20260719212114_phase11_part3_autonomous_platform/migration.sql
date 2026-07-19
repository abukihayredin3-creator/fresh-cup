-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ApprovalActionType" AS ENUM ('REFUND', 'DELETE', 'DISCOUNT', 'PROMOTION', 'INVENTORY_PURCHASE_ORDER', 'PRICE_CHANGE', 'MARKETING_CAMPAIGN', 'STAFFING_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkflowTriggerType" AS ENUM ('EVENT', 'SCHEDULE', 'MANUAL');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('RUNNING', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeSourceFormat" AS ENUM ('MARKDOWN', 'PLAIN_TEXT', 'PDF', 'DOCX', 'IMAGE');

-- CreateEnum
CREATE TYPE "RecommendationOutcomeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'IGNORED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiMemoryKind" ADD VALUE 'CUSTOMER_PREFERENCE';
ALTER TYPE "AiMemoryKind" ADD VALUE 'MANAGER_FEEDBACK';
ALTER TYPE "AiMemoryKind" ADD VALUE 'CAMPAIGN_HISTORY';
ALTER TYPE "AiMemoryKind" ADD VALUE 'SUPPLIER_ISSUE';
ALTER TYPE "AiMemoryKind" ADD VALUE 'INVENTORY_FAILURE';
ALTER TYPE "AiMemoryKind" ADD VALUE 'HOLIDAY_DEMAND';
ALTER TYPE "AiMemoryKind" ADD VALUE 'BRANCH_BEHAVIOR';
ALTER TYPE "AiMemoryKind" ADD VALUE 'STAFF_PERFORMANCE';
ALTER TYPE "AiMemoryKind" ADD VALUE 'LEARNING_DIGEST';

-- CreateTable
CREATE TABLE "ai_approval_requests" (
    "id" TEXT NOT NULL,
    "action_type" "ApprovalActionType" NOT NULL,
    "risk_level" "ApprovalRiskLevel" NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_agent" TEXT NOT NULL,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "branch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_workflow_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_type" "WorkflowTriggerType" NOT NULL,
    "trigger_config" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_workflow_runs" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'RUNNING',
    "context" JSONB NOT NULL,
    "step_log" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ai_workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_knowledge_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source_format" "KnowledgeSourceFormat" NOT NULL DEFAULT 'MARKDOWN',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_evaluation_records" (
    "id" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "model_key" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "context" JSONB,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_evaluation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendation_outcomes" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "status" "RecommendationOutcomeStatus" NOT NULL DEFAULT 'PENDING',
    "estimated_impact" DOUBLE PRECISION,
    "actual_impact" DOUBLE PRECISION,
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "flagged_hallucination" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendation_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_approval_requests_status_created_at_idx" ON "ai_approval_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_approval_requests_action_type_status_idx" ON "ai_approval_requests"("action_type", "status");

-- CreateIndex
CREATE INDEX "ai_workflow_runs_workflow_id_started_at_idx" ON "ai_workflow_runs"("workflow_id", "started_at");

-- CreateIndex
CREATE INDEX "ai_knowledge_documents_category_idx" ON "ai_knowledge_documents"("category");

-- CreateIndex
CREATE INDEX "ai_evaluation_records_metric_name_recorded_at_idx" ON "ai_evaluation_records"("metric_name", "recorded_at");

-- CreateIndex
CREATE INDEX "ai_recommendation_outcomes_source_status_idx" ON "ai_recommendation_outcomes"("source", "status");

-- AddForeignKey
ALTER TABLE "ai_approval_requests" ADD CONSTRAINT "ai_approval_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_approval_requests" ADD CONSTRAINT "ai_approval_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workflow_runs" ADD CONSTRAINT "ai_workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "ai_workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendation_outcomes" ADD CONSTRAINT "ai_recommendation_outcomes_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
