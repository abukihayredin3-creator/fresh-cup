"use client";

import { useState } from "react";
import { Badge, Card, DataTable, Select, StatCard } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import type { AiCopilotPriority } from "@fresh-cup/types";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useAiCopilotDashboard, useAiCopilotSummary } from "@/lib/use-ai-copilot";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

const PRIORITY_TONE: Record<AiCopilotPriority, "error" | "orange" | "neutral" | "green"> = {
  CRITICAL: "error",
  HIGH: "orange",
  MEDIUM: "neutral",
  LOW: "green",
};

function scoreTone(score: number): "up" | "down" | "neutral" {
  if (score >= 70) return "up";
  if (score < 50) return "down";
  return "neutral";
}

export default function AiCopilotPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const { data: branches } = useAdminBranches(isAdmin);

  const { data, isLoading } = useAiCopilotDashboard(branchId);
  const { data: summary, isLoading: isSummaryLoading } = useAiCopilotSummary(branchId);

  const health = data?.healthScore;
  const categoryScores = health
    ? [
        { label: "Revenue", value: health.revenueScore },
        { label: "Profit", value: health.profitScore },
        { label: "Inventory", value: health.inventoryScore },
        { label: "Customer", value: health.customerScore },
        { label: "Operations", value: health.operationsScore },
        { label: "Staff", value: health.staffScore },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h4 text-fg">AI CEO Copilot</h1>
          <p className="text-body-sm text-fg-muted">
            Business health, alerts, and AI-ranked priorities — assembled from the AI Brain and
            executive analytics, not recomputed here.
          </p>
        </div>
        {isAdmin && branches && branches.length > 0 ? (
          <div className="w-56">
            <Select
              label="Branch"
              hideLabel
              placeholder="All branches"
              value={branchId ?? ""}
              onChange={(e) => setBranchId(e.target.value || undefined)}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          </div>
        ) : null}
      </div>

      <Card>
        <h2 className="mb-2 font-display text-h5 text-fg">Executive summary</h2>
        <p className="text-body text-fg">
          {isSummaryLoading ? "Loading…" : (summary?.content ?? "No summary available yet.")}
        </p>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h5 text-fg">Business health score</h2>
          {health ? (
            <Badge
              tone={
                health.trend === "DECLINING"
                  ? "error"
                  : health.trend === "IMPROVING"
                    ? "green"
                    : "neutral"
              }
            >
              {health.trend}
            </Badge>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Overall health"
            value={health ? Math.round(health.overallScore) : "—"}
            trend={health ? scoreTone(health.overallScore) : "neutral"}
            loading={isLoading}
          />
          {categoryScores.map((c) => (
            <StatCard
              key={c.label}
              label={c.label}
              value={Math.round(c.value)}
              trend={scoreTone(c.value)}
              loading={isLoading}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Key performance indicators</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(data?.kpis ?? []).map((kpi) => (
            <StatCard
              key={kpi.label}
              label={kpi.label}
              value={
                kpi.label.toLowerCase().includes("rate")
                  ? `${Math.round(kpi.value * 100)}%`
                  : money(kpi.value)
              }
              loading={isLoading}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Active alerts</h2>
        <DataTable
          loading={isLoading}
          rows={data?.activeAlerts ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No active alerts"
          columns={[
            { key: "type", header: "Type", render: (row) => row.type },
            {
              key: "severity",
              header: "Severity",
              render: (row) => <Badge tone={PRIORITY_TONE[row.severity]}>{row.severity}</Badge>,
            },
            {
              key: "confidence",
              header: "Confidence",
              align: "end",
              render: (row) => `${Math.round(row.confidence * 100)}%`,
            },
            { key: "action", header: "Recommended action", render: (row) => row.recommendedAction },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">AI recommendations</h2>
        <DataTable
          loading={isLoading}
          rows={data?.aiRecommendations ?? []}
          rowKey={(row) => `${row.source}-${row.title}`}
          emptyTitle="No open recommendations"
          columns={[
            { key: "source", header: "Source", render: (row) => row.source },
            { key: "title", header: "Recommendation", render: (row) => row.title },
            {
              key: "priority",
              header: "Priority",
              render: (row) => <Badge tone={PRIORITY_TONE[row.priority]}>{row.priority}</Badge>,
            },
            {
              key: "confidence",
              header: "Confidence",
              align: "end",
              render: (row) => `${Math.round(row.confidence * 100)}%`,
            },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Forecasts</h2>
        <DataTable
          loading={isLoading}
          rows={data?.predictions ?? []}
          rowKey={(row) => `${row.metric}-${row.period}`}
          emptyTitle="No forecasts available"
          columns={[
            { key: "metric", header: "Metric", render: (row) => row.metric },
            { key: "period", header: "Period", render: (row) => row.period },
            {
              key: "forecast",
              header: "Forecast",
              align: "end",
              render: (row) => row.forecast.toLocaleString(),
            },
            {
              key: "confidence",
              header: "Confidence",
              align: "end",
              render: (row) => `${Math.round(row.confidence * 100)}%`,
            },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Recent AI decisions</h2>
        <DataTable
          loading={isLoading}
          rows={data?.priorityActions ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No AI decisions yet"
          columns={[
            { key: "type", header: "Decision type", render: (row) => row.decisionType },
            {
              key: "priority",
              header: "Priority",
              render: (row) => <Badge tone={PRIORITY_TONE[row.priority]}>{row.priority}</Badge>,
            },
            {
              key: "action",
              header: "Action",
              render: (row) => (row.output as { action: string }).action,
            },
            {
              key: "reason",
              header: "Reason",
              render: (row) => (row.output as { reason: string }).reason,
            },
            {
              key: "confidence",
              header: "Confidence",
              align: "end",
              render: (row) => `${Math.round(row.confidence * 100)}%`,
            },
          ]}
        />
      </Card>
    </div>
  );
}
