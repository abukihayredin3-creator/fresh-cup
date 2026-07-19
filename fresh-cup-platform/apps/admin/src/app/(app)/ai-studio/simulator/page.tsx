"use client";

import { Badge, Button, Card, LineChartWidget, Select } from "@fresh-cup/ui";
import type { ScenarioType } from "@fresh-cup/types";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useRunDigitalTwin, useRunScenario } from "@/lib/use-ai-studio";

const SCENARIO_OPTIONS: { value: ScenarioType; label: string }[] = [
  { value: "price_change", label: "Price change" },
  { value: "promotion", label: "Promotion (discount)" },
  { value: "staffing_change", label: "Staffing change" },
];

export default function AiStudioSimulatorPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: branches } = useAdminBranches(isAdmin);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [type, setType] = useState<ScenarioType>("price_change");
  const [magnitudePercent, setMagnitudePercent] = useState(5);

  const runScenario = useRunScenario();
  const runTwin = useRunDigitalTwin();

  function handleRun() {
    runScenario.mutate({ type, magnitudePercent, branchId });
    runTwin.mutate({ type, magnitudePercent, branchId });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-3 font-display text-h5 text-fg">
          Scenario Simulator (&quot;what if&quot;)
        </h2>
        <p className="mb-3 text-caption text-fg-muted">
          Read-only projection built on a documented elasticity heuristic — not fit to this
          restaurant&apos;s own price history (none exists). Confidence is intentionally capped low.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Scenario"
            value={type}
            onChange={(e) => setType(e.target.value as ScenarioType)}
            options={SCENARIO_OPTIONS}
            className="w-56"
          />
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Magnitude (%)
            <input
              type="number"
              value={magnitudePercent}
              onChange={(e) => setMagnitudePercent(Number(e.target.value))}
              className="w-32 rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg"
            />
          </label>
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
          <Button onClick={handleRun} loading={runScenario.isPending || runTwin.isPending}>
            Run simulation
          </Button>
        </div>
      </Card>

      {runScenario.data ? (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-h5 text-fg">Projected impact</h2>
            <Badge>{Math.round(runScenario.data.confidence * 100)}% confidence</Badge>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {runScenario.data.projections.map((p) => (
              <div key={p.metric} className="rounded border border-border p-3">
                <p className="text-caption text-fg-muted">{p.metric}</p>
                <p className="font-display text-h5 text-fg">
                  {p.changePercent > 0 ? "+" : ""}
                  {p.changePercent}%
                </p>
                <p className="text-caption text-fg-muted">
                  {p.baseline.toLocaleString()} → {p.projected.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <ul className="flex flex-col gap-1 text-caption text-fg-muted">
            {runScenario.data.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {runTwin.data ? (
        <Card>
          <h2 className="mb-3 font-display text-h5 text-fg">Digital Twin — projected timeline</h2>
          <LineChartWidget
            data={runTwin.data.timeline.map((day) => ({
              day: `Day ${day.day}`,
              revenue: day.revenueEtb,
              customers: day.customers,
            }))}
            xKey="day"
            series={[
              { key: "revenue", label: "Revenue (ETB)" },
              { key: "customers", label: "Customers" },
            ]}
          />
        </Card>
      ) : null}
    </div>
  );
}
