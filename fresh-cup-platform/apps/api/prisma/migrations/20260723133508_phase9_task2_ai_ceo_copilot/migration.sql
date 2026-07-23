-- CreateEnum
CREATE TYPE "HealthTrend" AS ENUM ('IMPROVING', 'STABLE', 'DECLINING');

-- CreateEnum
CREATE TYPE "ExecutiveAlertStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "executive_briefings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "briefing_date" TIMESTAMP(3) NOT NULL,
    "revenue_summary" JSONB NOT NULL,
    "profit_summary" JSONB NOT NULL,
    "top_products" JSONB NOT NULL,
    "bottom_products" JSONB NOT NULL,
    "inventory_alerts" JSONB NOT NULL,
    "staffing_alerts" JSONB NOT NULL,
    "ai_recommendations" JSONB NOT NULL,
    "risk_level" "AiPriority" NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executive_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_health_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "revenue_score" DOUBLE PRECISION NOT NULL,
    "profit_score" DOUBLE PRECISION NOT NULL,
    "inventory_score" DOUBLE PRECISION NOT NULL,
    "customer_score" DOUBLE PRECISION NOT NULL,
    "operations_score" DOUBLE PRECISION NOT NULL,
    "staff_score" DOUBLE PRECISION NOT NULL,
    "trend" "HealthTrend" NOT NULL DEFAULT 'STABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executive_alerts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "type" TEXT NOT NULL,
    "severity" "AiPriority" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB NOT NULL,
    "recommended_action" TEXT NOT NULL,
    "status" "ExecutiveAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executive_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executive_summaries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "period" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "key_metrics" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executive_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "executive_briefings_organization_id_branch_id_briefing_date_idx" ON "executive_briefings"("organization_id", "branch_id", "briefing_date");

-- CreateIndex
CREATE INDEX "business_health_snapshots_organization_id_branch_id_created_idx" ON "business_health_snapshots"("organization_id", "branch_id", "created_at");

-- CreateIndex
CREATE INDEX "executive_alerts_organization_id_branch_id_status_idx" ON "executive_alerts"("organization_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "executive_alerts_organization_id_type_idx" ON "executive_alerts"("organization_id", "type");

-- CreateIndex
CREATE INDEX "executive_summaries_organization_id_branch_id_created_at_idx" ON "executive_summaries"("organization_id", "branch_id", "created_at");

-- AddForeignKey
ALTER TABLE "executive_briefings" ADD CONSTRAINT "executive_briefings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_briefings" ADD CONSTRAINT "executive_briefings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_health_snapshots" ADD CONSTRAINT "business_health_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_health_snapshots" ADD CONSTRAINT "business_health_snapshots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_alerts" ADD CONSTRAINT "executive_alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_alerts" ADD CONSTRAINT "executive_alerts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_summaries" ADD CONSTRAINT "executive_summaries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_summaries" ADD CONSTRAINT "executive_summaries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
