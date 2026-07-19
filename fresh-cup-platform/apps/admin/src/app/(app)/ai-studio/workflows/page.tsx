"use client";

import { Badge, Button, Card, DataTable, Select, useToast } from "@fresh-cup/ui";
import type { AiWorkflowRun } from "@fresh-cup/types";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches } from "@/lib/use-dashboard";
import {
  useDraftCoupon,
  useDraftDeliveryStaffing,
  useDraftEmployeeScheduling,
  useDraftKitchenStaffing,
  useDraftMarketingCampaign,
  useDraftPromotion,
  useRunLowStockReorder,
  useWorkflowDefinitions,
  useWorkflowRuns,
} from "@/lib/use-ai-studio";

const RUN_STATUS_TONE: Record<string, "green" | "orange" | "error" | "neutral"> = {
  RUNNING: "neutral",
  WAITING_APPROVAL: "orange",
  COMPLETED: "green",
  FAILED: "error",
};

export default function AiStudioWorkflowsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: branches } = useAdminBranches(isAdmin);
  const [branchId, setBranchId] = useState<string | undefined>(branches?.[0]?.id);
  const { show: showToast } = useToast();

  const { data: definitions } = useWorkflowDefinitions();
  const { data: runs, isLoading: runsLoading } = useWorkflowRuns();
  const runLowStock = useRunLowStockReorder();

  const draftMarketing = useDraftMarketingCampaign();
  const draftCoupon = useDraftCoupon();
  const draftPromotion = useDraftPromotion();
  const draftKitchen = useDraftKitchenStaffing();
  const draftDelivery = useDraftDeliveryStaffing();
  const draftScheduling = useDraftEmployeeScheduling();

  async function handleRunWorkflow() {
    if (!branchId) {
      showToast({ title: "Choose a branch first", tone: "error" });
      return;
    }
    try {
      const run = await runLowStock.mutateAsync(branchId);
      showToast({ title: `Workflow finished: ${run.status}`, tone: "success" });
    } catch {
      showToast({ title: "Workflow run failed", tone: "error" });
    }
  }

  async function handleDraft(label: string, run: () => Promise<unknown>) {
    try {
      const result = await run();
      showToast({
        title: result
          ? `${label} drafted for approval`
          : `Nothing to draft for ${label.toLowerCase()}`,
        tone: result ? "success" : "neutral",
      });
    } catch {
      showToast({ title: `Could not draft ${label.toLowerCase()}`, tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-h5 text-fg">AI Workflow Engine</h2>
          {isAdmin && branches && branches.length > 0 ? (
            <Select
              label="Branch"
              value={branchId ?? ""}
              onChange={(e) => setBranchId(e.target.value || undefined)}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              placeholder="Choose a branch"
              className="w-56"
            />
          ) : null}
        </div>
        <p className="mb-3 text-body-sm text-fg-muted">
          {definitions?.[0]?.description ??
            "Detect low stock → check supplier → draft a purchase order for approval → notify → track."}
        </p>
        <Button onClick={handleRunWorkflow} loading={runLowStock.isPending}>
          Run low-stock reorder workflow now
        </Button>
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-h5 text-fg">AI Automation drafts</h2>
        <p className="mb-3 text-caption text-fg-muted">
          Each button drafts a suggestion into the Approval inbox — nothing executes automatically.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => handleDraft("Marketing campaign", () => draftMarketing.mutateAsync())}
          >
            Draft marketing campaign
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleDraft("Coupon", () => draftCoupon.mutateAsync())}
          >
            Draft coupon
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleDraft("Promotion", () => draftPromotion.mutateAsync())}
          >
            Draft promotion
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              handleDraft("Kitchen staffing", () => draftKitchen.mutateAsync(branchId))
            }
          >
            Draft kitchen staffing
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              handleDraft("Delivery staffing", () => draftDelivery.mutateAsync(branchId))
            }
          >
            Draft delivery staffing
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              handleDraft("Employee scheduling", () => draftScheduling.mutateAsync(branchId))
            }
          >
            Draft employee scheduling
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-h5 text-fg">Recent workflow runs</h2>
        <DataTable<AiWorkflowRun>
          loading={runsLoading}
          rows={runs ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No workflow runs yet"
          columns={[
            {
              key: "status",
              header: "Status",
              render: (row) => <Badge tone={RUN_STATUS_TONE[row.status]}>{row.status}</Badge>,
            },
            {
              key: "steps",
              header: "Steps",
              render: (row) => `${row.stepLog.length} step(s)`,
            },
            {
              key: "started",
              header: "Started",
              render: (row) => new Date(row.startedAt).toLocaleString(),
            },
          ]}
        />
      </Card>
    </div>
  );
}
