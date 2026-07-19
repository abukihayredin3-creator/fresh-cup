-- CreateEnum
CREATE TYPE "ForecastMetric" AS ENUM ('SALES_REVENUE', 'SALES_ORDERS', 'HOURLY_DEMAND', 'PRODUCT_DEMAND', 'INGREDIENT_DEMAND');

-- CreateEnum
CREATE TYPE "ForecastGranularity" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "MlModelStatus" AS ENUM ('READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AiQueryOutcome" AS ENUM ('ANSWERED', 'FALLBACK', 'ERROR');

-- CreateTable
CREATE TABLE "ml_model_runs" (
    "id" TEXT NOT NULL,
    "model_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "MlModelStatus" NOT NULL DEFAULT 'READY',
    "metrics" JSONB,
    "notes" TEXT,
    "trained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_model_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_snapshots" (
    "id" TEXT NOT NULL,
    "model_run_id" TEXT NOT NULL,
    "metric" "ForecastMetric" NOT NULL,
    "granularity" "ForecastGranularity" NOT NULL,
    "target_period_start" TIMESTAMP(3) NOT NULL,
    "branch_id" TEXT,
    "menu_item_id" TEXT,
    "inventory_item_id" TEXT,
    "predicted_value" DECIMAL(14,3) NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "actual_value" DECIMAL(14,3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecast_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_assistant_queries" (
    "id" TEXT NOT NULL,
    "asked_by_user_id" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tool_calls" JSONB,
    "outcome" "AiQueryOutcome" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_assistant_queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ml_model_runs_model_key_trained_at_idx" ON "ml_model_runs"("model_key", "trained_at");

-- CreateIndex
CREATE UNIQUE INDEX "ml_model_runs_model_key_version_key" ON "ml_model_runs"("model_key", "version");

-- CreateIndex
CREATE INDEX "forecast_snapshots_metric_granularity_target_period_start_idx" ON "forecast_snapshots"("metric", "granularity", "target_period_start");

-- CreateIndex
CREATE INDEX "forecast_snapshots_branch_id_metric_target_period_start_idx" ON "forecast_snapshots"("branch_id", "metric", "target_period_start");

-- CreateIndex
CREATE INDEX "forecast_snapshots_menu_item_id_target_period_start_idx" ON "forecast_snapshots"("menu_item_id", "target_period_start");

-- CreateIndex
CREATE INDEX "forecast_snapshots_inventory_item_id_target_period_start_idx" ON "forecast_snapshots"("inventory_item_id", "target_period_start");

-- CreateIndex
CREATE INDEX "ai_assistant_queries_asked_by_user_id_created_at_idx" ON "ai_assistant_queries"("asked_by_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_model_run_id_fkey" FOREIGN KEY ("model_run_id") REFERENCES "ml_model_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_assistant_queries" ADD CONSTRAINT "ai_assistant_queries_asked_by_user_id_fkey" FOREIGN KEY ("asked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
