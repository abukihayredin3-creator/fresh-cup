-- CreateEnum
CREATE TYPE "PredictiveModelStage" AS ENUM ('EXPERIMENTAL', 'STAGING', 'PRODUCTION', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DriftType" AS ENUM ('FEATURE_DRIFT', 'PREDICTION_DRIFT', 'DATA_DRIFT', 'CONCEPT_DRIFT');

-- CreateEnum
CREATE TYPE "DriftSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "predictive_model_runs" (
    "id" TEXT NOT NULL,
    "model_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "MlModelStatus" NOT NULL DEFAULT 'READY',
    "deployment_stage" "PredictiveModelStage" NOT NULL DEFAULT 'EXPERIMENTAL',
    "dataset_hash" TEXT NOT NULL,
    "dataset_version" TEXT NOT NULL,
    "sample_count" INTEGER NOT NULL,
    "feature_schema" JSONB NOT NULL,
    "metrics" JSONB,
    "notes" TEXT,
    "trained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predictive_model_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drift_alerts" (
    "id" TEXT NOT NULL,
    "model_key" TEXT NOT NULL,
    "drift_type" "DriftType" NOT NULL,
    "severity" "DriftSeverity" NOT NULL,
    "metric_name" TEXT NOT NULL,
    "baseline_value" DOUBLE PRECISION NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL,
    "detail" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "drift_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "predictive_model_runs_model_key_deployment_stage_idx" ON "predictive_model_runs"("model_key", "deployment_stage");

-- CreateIndex
CREATE UNIQUE INDEX "predictive_model_runs_model_key_version_key" ON "predictive_model_runs"("model_key", "version");

-- CreateIndex
CREATE INDEX "drift_alerts_model_key_detected_at_idx" ON "drift_alerts"("model_key", "detected_at");

-- CreateIndex
CREATE INDEX "drift_alerts_resolved_at_idx" ON "drift_alerts"("resolved_at");
