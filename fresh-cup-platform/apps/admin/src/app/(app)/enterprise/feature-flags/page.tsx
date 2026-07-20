"use client";

import { Badge, Button, Card, DataTable, Input, Select, useToast } from "@fresh-cup/ui";
import type { FeatureFlagOverride } from "@fresh-cup/types";
import { useState } from "react";
import {
  useFeatureFlagDefinitions,
  useFeatureFlagOverrides,
  useSetFeatureFlagOverride,
} from "@/lib/use-enterprise";

const ENABLED_OPTIONS = [
  { value: "true", label: "Enabled" },
  { value: "false", label: "Disabled" },
];

export default function EnterpriseFeatureFlagsPage() {
  const { data: definitions, isLoading: isDefinitionsLoading } = useFeatureFlagDefinitions();
  const { data: overrides, isLoading: isOverridesLoading } = useFeatureFlagOverrides();
  const setOverride = useSetFeatureFlagOverride();
  const { show: showToast } = useToast();

  const [key, setKey] = useState("");
  const [enabled, setEnabled] = useState("true");
  const [rolloutPercentage, setRolloutPercentage] = useState("");

  const definitionByKey = new Map((definitions ?? []).map((d) => [d.id, d.key]));

  async function handleSetOverride() {
    if (!key) {
      showToast({ title: "Pick a flag key first", tone: "error" });
      return;
    }
    try {
      await setOverride.mutateAsync({
        key,
        input: {
          enabled: enabled === "true",
          rolloutPercentage: rolloutPercentage ? Number(rolloutPercentage) : undefined,
        },
      });
      showToast({ title: `Override set for ${key}`, tone: "success" });
    } catch {
      showToast({ title: "Could not set override", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Set an override for this organization</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Flag key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            options={[
              { value: "", label: "Select a flag" },
              ...(definitions ?? []).map((d) => ({ value: d.key, label: `${d.key} — ${d.name}` })),
            ]}
          />
          <Select
            label="State"
            value={enabled}
            onChange={(e) => setEnabled(e.target.value)}
            options={ENABLED_OPTIONS}
          />
          <Input
            label="Rollout %"
            type="number"
            min={0}
            max={100}
            value={rolloutPercentage}
            onChange={(e) => setRolloutPercentage(e.target.value)}
            hint="Optional — partial rollout percentage"
          />
        </div>
        <div className="mt-4">
          <Button onClick={handleSetOverride} loading={setOverride.isPending}>
            Set override
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Registered flags</h2>
        <DataTable
          loading={isDefinitionsLoading}
          rows={definitions ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No feature flags registered"
          columns={[
            { key: "key", header: "Key", render: (row) => row.key },
            { key: "name", header: "Name", render: (row) => row.name },
            {
              key: "default",
              header: "Default",
              render: (row) => (
                <Badge tone={row.defaultEnabled ? "green" : "neutral"}>
                  {row.defaultEnabled ? "On" : "Off"}
                </Badge>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">This organization&apos;s overrides</h2>
        <DataTable<FeatureFlagOverride>
          loading={isOverridesLoading}
          rows={overrides ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No overrides set"
          columns={[
            {
              key: "key",
              header: "Flag",
              render: (row) => definitionByKey.get(row.featureFlagId) ?? row.featureFlagId,
            },
            {
              key: "enabled",
              header: "State",
              render: (row) => (
                <Badge tone={row.enabled ? "green" : "neutral"}>{row.enabled ? "On" : "Off"}</Badge>
              ),
            },
            {
              key: "scope",
              header: "Scope",
              render: (row) => (row.branchId ? `Branch ${row.branchId}` : "Org-wide"),
            },
            {
              key: "rollout",
              header: "Rollout %",
              render: (row) => row.rolloutPercentage ?? "—",
            },
          ]}
        />
      </Card>
    </div>
  );
}
