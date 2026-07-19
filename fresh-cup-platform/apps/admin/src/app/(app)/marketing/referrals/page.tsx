"use client";

import { Badge, Button, Card, DataTable, Dialog, Input, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  useCreateReferralCode,
  useReferralCodes,
  useReferralRedemptions,
  useUpdateReferralCode,
} from "@/lib/use-marketing";

function RedemptionsPanel({ codeId }: { codeId: string }) {
  const { data, isLoading } = useReferralRedemptions(codeId);

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">Redemptions</p>
      <DataTable
        caption="Referral redemptions"
        loading={isLoading}
        rows={data ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No redemptions yet"
        columns={[
          { key: "user", header: "Referred user", render: (row) => row.referredUserId },
          { key: "order", header: "Order", render: (row) => row.orderId ?? "—" },
          {
            key: "date",
            header: "Date",
            render: (row) => new Date(row.createdAt).toLocaleDateString(),
          },
        ]}
      />
    </Card>
  );
}

export default function ReferralsPage() {
  const { data, isLoading } = useReferralCodes({});
  const createCode = useCreateReferralCode();
  const updateCode = useUpdateReferralCode();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createCode.mutateAsync({
        userId,
        rewardAmount: Math.round(Number(rewardAmount) * 100),
      });
      showToast({ title: "Referral code created", tone: "success" });
      setOpen(false);
      setUserId("");
      setRewardAmount("");
    } catch {
      setError("Could not create the referral code. Check the user id and try again.");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      await updateCode.mutateAsync({ id, input: { isActive: !isActive } });
      showToast({ title: "Referral code updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update referral code", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Referral Codes</h1>
        <div className="flex items-center gap-3">
          <Link href="/marketing" className="text-body-sm text-accent-text hover:underline">
            Back to marketing
          </Link>
          <Button onClick={() => setOpen(true)}>New Referral Code</Button>
        </div>
      </div>

      <DataTable
        caption="Referral codes"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No referral codes yet"
        columns={[
          {
            key: "code",
            header: "Code",
            render: (row) => (
              <button
                type="button"
                onClick={() => setSelectedCodeId(row.id)}
                className="text-accent-text hover:underline"
              >
                {row.code}
              </button>
            ),
          },
          { key: "uses", header: "Uses", render: (row) => row.usesCount },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge tone={row.isActive ? "green" : "neutral"}>
                {row.isActive ? "Active" : "Inactive"}
              </Badge>
            ),
          },
          {
            key: "actions",
            header: "",
            align: "end",
            render: (row) => (
              <button
                type="button"
                onClick={() => handleToggleActive(row.id, row.isActive)}
                className="text-caption text-fg-muted underline-offset-2 hover:underline"
              >
                {row.isActive ? "Deactivate" : "Activate"}
              </button>
            ),
          },
        ]}
      />

      {selectedCodeId ? <RedemptionsPanel codeId={selectedCodeId} /> : null}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title="New referral code"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {error ? (
            <p
              role="alert"
              className="rounded border border-error-600 bg-error-600/15 px-3 py-2 text-body-sm text-fg"
            >
              {error}
            </p>
          ) : null}
          <Input
            label="User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            hint="The customer this referral code belongs to"
            required
          />
          <Input
            label="Reward amount (ETB)"
            type="number"
            min={0}
            step="0.01"
            value={rewardAmount}
            onChange={(e) => setRewardAmount(e.target.value)}
            required
          />
          <Button
            type="submit"
            loading={createCode.isPending}
            disabled={!userId.trim() || !rewardAmount}
          >
            Create referral code
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
