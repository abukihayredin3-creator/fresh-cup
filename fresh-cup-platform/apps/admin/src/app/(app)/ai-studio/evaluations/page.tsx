"use client";

import { Badge, Card, DataTable, StatCard } from "@fresh-cup/ui";
import type { PromptRecord } from "@fresh-cup/types";
import { useAcceptanceRate, useBusinessImpact, usePrompts } from "@/lib/use-ai-studio";

export default function AiStudioEvaluationsPage() {
  const { data: acceptance } = useAcceptanceRate();
  const { data: impact } = useBusinessImpact();
  const { data: prompts, isLoading: promptsLoading } = usePrompts();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Recommendation acceptance rate"
          value={acceptance ? `${Math.round(acceptance.rate * 100)}%` : "—"}
          delta={
            acceptance
              ? `${acceptance.accepted} accepted, ${acceptance.rejected} rejected`
              : undefined
          }
        />
        <StatCard
          label="Estimated business impact"
          value={impact ? `${impact.estimatedTotal.toLocaleString()} ETB` : "—"}
        />
        <StatCard
          label="Actual business impact"
          value={impact ? `${impact.actualTotal.toLocaleString()} ETB` : "—"}
        />
      </div>

      <Card>
        <h2 className="mb-1 font-display text-h5 text-fg">AI Governance — system prompts</h2>
        <p className="mb-3 text-caption text-fg-muted">
          Every domain agent&apos;s prompt is static code, not a live-editable CMS — the fingerprint
          changes the moment the underlying prompt text does.
        </p>
        <DataTable<PromptRecord>
          loading={promptsLoading}
          rows={prompts ?? []}
          rowKey={(row) => row.domain}
          emptyTitle="No prompts registered"
          columns={[
            { key: "domain", header: "Domain", render: (row) => <Badge>{row.domain}</Badge> },
            {
              key: "fingerprint",
              header: "Fingerprint",
              render: (row) => <code className="text-caption">{row.fingerprint}</code>,
            },
            {
              key: "prompt",
              header: "Prompt (excerpt)",
              render: (row) => (
                <span className="text-caption text-fg-muted">{row.prompt.slice(0, 80)}…</span>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-1 font-display text-h5 text-fg">Continuous Evaluation</h2>
        <p className="text-body-sm text-fg-muted">
          Accuracy/precision/recall/latency measurements are logged per model via POST
          /admin/ai/evaluations and reviewed alongside Part 2&apos;s model registry (Predictive
          Intelligence tab). Hallucination rate has no automatic detector — flag one manually from a
          recommendation&apos;s outcome record when it&apos;s unfounded.
        </p>
      </Card>
    </div>
  );
}
