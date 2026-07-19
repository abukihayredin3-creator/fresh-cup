"use client";

import type {
  ClusteringStrategyName,
  DriftAlert,
  PredictionResult,
  PredictiveModelRun,
  PredictiveModelStage,
} from "@fresh-cup/types";
import {
  Badge,
  BarChartWidget,
  Button,
  Card,
  DataTable,
  Select,
  Skeleton,
  useToast,
} from "@fresh-cup/ui";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches } from "@/lib/use-dashboard";
import {
  useAiBestSellersForecast,
  useAiCategoryTrendsForecast,
  useAiRevenueForecast,
  useCustomerPredictions,
  useCustomerSegments,
  useDriftAlerts,
  useModelRegistryRuns,
  usePredictiveSegmentationSummary,
  usePromoteModel,
  useResolveDriftAlert,
  useRetrainAllDue,
} from "@/lib/use-intelligence";

// Mirrors apps/api's intelligence/training/retraining.service.ts TRAINABLE_MODEL_KEYS.
const MODEL_KEYS = [
  "customer-lifetime-value",
  "repeat-purchase-probability",
  "customer-churn",
  "customer-upsell",
  "customer-cross-sell",
  "customer-coupon-response",
  "customer-referral-probability",
  "customer-satisfaction",
  "sales-hourly",
  "sales-daily",
  "sales-weekly",
  "sales-monthly",
  "sales-revenue",
  "sales-transactions",
  "sales-average-ticket",
  "sales-best-sellers",
  "sales-category-trends",
] as const;

const STAGE_OPTIONS: { value: PredictiveModelStage; label: string }[] = [
  { value: "EXPERIMENTAL", label: "Experimental" },
  { value: "STAGING", label: "Staging" },
  { value: "PRODUCTION", label: "Production" },
  { value: "ARCHIVED", label: "Archived" },
];

const STAGE_TONE: Record<PredictiveModelStage, "green" | "orange" | "error" | "neutral"> = {
  PRODUCTION: "green",
  STAGING: "orange",
  EXPERIMENTAL: "neutral",
  ARCHIVED: "error",
};

const SEVERITY_TONE: Record<string, "green" | "orange" | "error" | "neutral"> = {
  LOW: "neutral",
  MEDIUM: "orange",
  HIGH: "error",
};

function confidenceTone(confidence: number): "green" | "orange" | "error" {
  if (confidence >= 0.66) return "green";
  if (confidence >= 0.33) return "orange";
  return "error";
}

function PredictionCard({ title, result }: { title: string; result: PredictionResult }) {
  const topFactors = [...result.contributingFactors]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 4);
  const maxAbs = Math.max(...topFactors.map((f) => Math.abs(f.contribution)), 0.0001);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-h6 text-fg">{title}</h3>
        <Badge tone={confidenceTone(result.confidence)}>
          {Math.round(result.confidence * 100)}% confidence
        </Badge>
      </div>
      <p className="font-display text-h4 text-fg">
        {typeof result.prediction === "number"
          ? result.prediction <= 1 && result.prediction >= 0
            ? `${Math.round(result.prediction * 100)}%`
            : result.prediction.toLocaleString()
          : String(result.prediction)}
      </p>

      {topFactors.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {topFactors.map((factor) => (
            <div key={factor.feature} className="flex flex-col gap-0.5">
              <div className="flex justify-between text-caption text-fg-muted">
                <span>{factor.feature}</span>
                <span>{factor.value.toLocaleString()}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-pill bg-border">
                <div
                  className={
                    factor.direction === "positive"
                      ? "h-full bg-success-text"
                      : "h-full bg-danger-text"
                  }
                  style={{ width: `${(Math.abs(factor.contribution) / maxAbs) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <ul className="list-inside list-disc text-body-sm text-fg-muted">
        {result.topReasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      <p className="rounded bg-surface-alt px-3 py-2 text-body-sm text-fg">
        {result.suggestedAction}
      </p>
    </Card>
  );
}

export default function PredictiveIntelligencePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: branches } = useAdminBranches(isAdmin);
  const { show: showToast } = useToast();

  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [modelKey, setModelKey] = useState<(typeof MODEL_KEYS)[number]>(MODEL_KEYS[0]);
  const [segmentStrategy, setSegmentStrategy] = useState<ClusteringStrategyName>("rule-based");
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);

  const { data: customerList } = useCustomerSegments({ branchId, limit: 50 });
  const { data: predictions, isLoading: predictionsLoading } =
    useCustomerPredictions(selectedUserId);

  const { data: categoryTrends } = useAiCategoryTrendsForecast(branchId);
  const { data: bestSellers } = useAiBestSellersForecast(branchId);
  const { data: revenueForecast } = useAiRevenueForecast(branchId);

  const { data: runs, isLoading: runsLoading } = useModelRegistryRuns(modelKey);
  const promote = usePromoteModel();

  const { data: alerts, isLoading: alertsLoading } = useDriftAlerts(undefined, unresolvedOnly);
  const resolveAlert = useResolveDriftAlert();

  const { data: segmentSummary } = usePredictiveSegmentationSummary(branchId, segmentStrategy);

  const retrainAll = useRetrainAllDue();

  async function handleRetrainAll() {
    try {
      const results = await retrainAll.mutateAsync();
      const due = results.filter((r) => r.shouldRetrain).length;
      showToast({
        title: due > 0 ? `Retrained ${due} model(s)` : "No model needed retraining",
        tone: "success",
      });
    } catch {
      showToast({ title: "Retrain check failed", tone: "error" });
    }
  }

  async function handlePromote(runModelKey: string, version: number, stage: PredictiveModelStage) {
    try {
      await promote.mutateAsync({ modelKey: runModelKey, version, stage });
      showToast({ title: `Promoted v${version} to ${stage}`, tone: "success" });
    } catch {
      showToast({ title: "Promotion failed", tone: "error" });
    }
  }

  async function handleResolve(id: string) {
    try {
      await resolveAlert.mutateAsync(id);
      showToast({ title: "Alert resolved", tone: "success" });
    } catch {
      showToast({ title: "Could not resolve alert", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        {isAdmin && branches && branches.length > 0 ? (
          <Select
            label="Branch"
            value={branchId ?? ""}
            onChange={(e) => setBranchId(e.target.value || undefined)}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            placeholder="All branches"
            className="w-56"
          />
        ) : null}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-h5 text-fg">Customer predictions</h2>
          <Select
            label="Customer"
            hideLabel
            value={selectedUserId ?? ""}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            options={(customerList?.customers ?? []).map((c) => ({
              value: c.userId,
              label: c.fullName,
            }))}
            placeholder="Choose a customer"
            className="w-64"
          />
        </div>
        {!selectedUserId ? (
          <div className="flex h-[120px] items-center justify-center text-body-sm text-fg-muted">
            Choose a customer above to see all 8 predictive models for them.
          </div>
        ) : predictionsLoading || !predictions ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PredictionCard title="Lifetime value" result={predictions.clv} />
            <PredictionCard title="Repeat purchase" result={predictions.repeatPurchase} />
            <PredictionCard title="Churn risk" result={predictions.churn} />
            <PredictionCard title="Upsell" result={predictions.upsell} />
            <PredictionCard title="Cross-sell" result={predictions.crossSell} />
            <PredictionCard title="Coupon response" result={predictions.couponResponse} />
            <PredictionCard title="Referral probability" result={predictions.referral} />
            <PredictionCard title="Satisfaction" result={predictions.satisfaction} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-display text-h5 text-fg">Revenue forecast</h2>
          {revenueForecast ? (
            <>
              <p className="font-display text-h3 text-fg">
                {revenueForecast.prediction.toLocaleString()} ETB
              </p>
              <Badge tone={confidenceTone(revenueForecast.confidence)}>
                {Math.round(revenueForecast.confidence * 100)}% confidence
              </Badge>
              <p className="mt-3 text-body-sm text-fg-muted">{revenueForecast.suggestedAction}</p>
            </>
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-h5 text-fg">Predicted best sellers</h2>
          <ul className="flex flex-col gap-2 text-body-sm text-fg">
            {(bestSellers?.prediction ?? []).slice(0, 5).map((p) => (
              <li key={p.nameEn} className="flex justify-between">
                <span>{p.nameEn}</span>
                <span className="text-fg-muted">{Math.round(p.totalPredicted)}</span>
              </li>
            ))}
            {!bestSellers || bestSellers.prediction.length === 0 ? (
              <li className="text-fg-muted">No forecast yet.</li>
            ) : null}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-h5 text-fg">Category trends</h2>
          <ul className="flex flex-col gap-2 text-body-sm text-fg">
            {(categoryTrends?.prediction ?? []).slice(0, 5).map((c) => (
              <li key={c.category} className="flex items-center justify-between">
                <span>{c.category}</span>
                <Badge
                  tone={
                    c.trend === "rising" ? "green" : c.trend === "falling" ? "error" : "neutral"
                  }
                >
                  {c.trend}
                </Badge>
              </li>
            ))}
            {!categoryTrends || categoryTrends.prediction.length === 0 ? (
              <li className="text-fg-muted">No forecast yet.</li>
            ) : null}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">
          Segmentation (configurable clustering)
        </h2>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Select
            label="Strategy"
            value={segmentStrategy}
            onChange={(e) => setSegmentStrategy(e.target.value as ClusteringStrategyName)}
            options={[
              { value: "rule-based", label: "Rule-based (RFM)" },
              { value: "kmeans", label: "K-means" },
            ]}
            className="w-56"
          />
        </div>
        {!segmentSummary || segmentSummary.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-body-sm text-fg-muted">
            No customer order history yet.
          </div>
        ) : (
          <BarChartWidget
            data={segmentSummary.map((s) => ({ segment: s.segment, customers: s.customerCount }))}
            xKey="segment"
            series={[{ key: "customers", label: "Customers" }]}
          />
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-h5 text-fg">Model registry</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Model"
              hideLabel
              value={modelKey}
              onChange={(e) => setModelKey(e.target.value as (typeof MODEL_KEYS)[number])}
              options={MODEL_KEYS.map((k) => ({ value: k, label: k }))}
              className="w-64"
            />
            {isAdmin ? (
              <Button variant="secondary" onClick={handleRetrainAll} loading={retrainAll.isPending}>
                Check &amp; retrain all due
              </Button>
            ) : null}
          </div>
        </div>
        <DataTable<PredictiveModelRun>
          loading={runsLoading}
          rows={runs ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No registry runs for this model yet"
          columns={[
            { key: "version", header: "Version", render: (row) => `v${row.version}` },
            {
              key: "stage",
              header: "Stage",
              render: (row) => (
                <Badge tone={STAGE_TONE[row.deploymentStage]}>{row.deploymentStage}</Badge>
              ),
            },
            { key: "samples", header: "Samples", align: "end", render: (row) => row.sampleCount },
            {
              key: "dataset",
              header: "Dataset version",
              render: (row) => row.datasetVersion,
            },
            {
              key: "trained",
              header: "Trained at",
              render: (row) => new Date(row.trainedAt).toLocaleString(),
            },
            ...(isAdmin
              ? [
                  {
                    key: "actions",
                    header: "Promote to",
                    render: (row: PredictiveModelRun) => (
                      <Select
                        label="Promote to"
                        hideLabel
                        value=""
                        onChange={(e) =>
                          e.target.value &&
                          handlePromote(
                            row.modelKey,
                            row.version,
                            e.target.value as PredictiveModelStage,
                          )
                        }
                        options={STAGE_OPTIONS.filter((s) => s.value !== row.deploymentStage)}
                        placeholder="Change stage"
                        className="w-40"
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-h5 text-fg">Drift alerts</h2>
          <Button variant="secondary" onClick={() => setUnresolvedOnly((v) => !v)}>
            {unresolvedOnly ? "Showing unresolved only" : "Showing all"}
          </Button>
        </div>
        <DataTable<DriftAlert>
          loading={alertsLoading}
          rows={alerts ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No drift detected"
          columns={[
            { key: "model", header: "Model", render: (row) => row.modelKey },
            { key: "type", header: "Type", render: (row) => row.driftType },
            {
              key: "severity",
              header: "Severity",
              render: (row) => <Badge tone={SEVERITY_TONE[row.severity]}>{row.severity}</Badge>,
            },
            { key: "detail", header: "Detail", render: (row) => row.detail },
            {
              key: "detected",
              header: "Detected",
              render: (row) => new Date(row.detectedAt).toLocaleString(),
            },
            {
              key: "actions",
              header: "",
              render: (row) =>
                row.resolvedAt ? (
                  <span className="text-fg-muted">Resolved</span>
                ) : (
                  <Button variant="ghost" onClick={() => handleResolve(row.id)}>
                    Resolve
                  </Button>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
