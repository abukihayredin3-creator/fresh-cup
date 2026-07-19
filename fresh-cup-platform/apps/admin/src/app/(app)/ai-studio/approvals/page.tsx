"use client";

import { Badge, Button, Card, DataTable, Select, useToast } from "@fresh-cup/ui";
import type { AiApprovalRequest, ApprovalStatus } from "@fresh-cup/types";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApprovals, useApproveRequest, useRejectRequest } from "@/lib/use-ai-studio";

const STATUS_OPTIONS: { value: ApprovalStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const RISK_TONE: Record<string, "green" | "orange" | "error" | "neutral"> = {
  LOW: "neutral",
  MEDIUM: "orange",
  HIGH: "error",
  CRITICAL: "error",
};

const STATUS_TONE: Record<string, "green" | "orange" | "error" | "neutral"> = {
  PENDING: "orange",
  APPROVED: "green",
  REJECTED: "error",
};

export default function AiStudioApprovalsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [status, setStatus] = useState<ApprovalStatus | "">("PENDING");
  const { data: approvals, isLoading } = useApprovals(status || undefined);
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const { show: showToast } = useToast();

  async function handleApprove(id: string) {
    try {
      const result = await approve.mutateAsync({ id });
      showToast({ title: result.executionNote, tone: "success" });
    } catch {
      showToast({ title: "Approval failed", tone: "error" });
    }
  }

  async function handleReject(id: string) {
    try {
      await reject.mutateAsync({ id });
      showToast({ title: "Request rejected", tone: "success" });
    } catch {
      showToast({ title: "Could not reject request", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-h5 text-fg">Human Approval Layer</h2>
          <Select
            label="Status"
            hideLabel
            value={status}
            onChange={(e) => setStatus(e.target.value as ApprovalStatus | "")}
            options={STATUS_OPTIONS}
            className="w-48"
          />
        </div>
        <DataTable<AiApprovalRequest>
          loading={isLoading}
          rows={approvals ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No approval requests"
          columns={[
            { key: "summary", header: "Summary", render: (row) => row.summary },
            { key: "type", header: "Type", render: (row) => row.actionType },
            {
              key: "risk",
              header: "Risk",
              render: (row) => <Badge tone={RISK_TONE[row.riskLevel]}>{row.riskLevel}</Badge>,
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
            },
            { key: "agent", header: "Requested by", render: (row) => row.requestedByAgent },
            {
              key: "created",
              header: "Created",
              render: (row) => new Date(row.createdAt).toLocaleString(),
            },
            {
              key: "actions",
              header: "",
              render: (row) =>
                row.status === "PENDING" ? (
                  <div className="flex gap-2">
                    {isAdmin ? (
                      <Button
                        variant="secondary"
                        onClick={() => handleApprove(row.id)}
                        loading={approve.isPending}
                      >
                        Approve
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      onClick={() => handleReject(row.id)}
                      loading={reject.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-fg-muted">{row.reviewNotes ?? "—"}</span>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
