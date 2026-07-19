"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Badge, Button, DataTable, Dialog, Input, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdjustGiftCard, useCreateGiftCard, useGiftCards } from "@/lib/use-marketing";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function GiftCardsPage() {
  const { data, isLoading } = useGiftCards({});
  const createGiftCard = useCreateGiftCard();
  const adjustGiftCard = useAdjustGiftCard();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [initialBalance, setInitialBalance] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createGiftCard.mutateAsync({
        initialBalance: Math.round(Number(initialBalance) * 100),
      });
      showToast({ title: "Gift card created", tone: "success" });
      setOpen(false);
      setInitialBalance("");
    } catch {
      setError("Could not create the gift card. Check the details and try again.");
    }
  }

  async function handleAdjust(id: string) {
    if (!adjustAmount) return;
    try {
      await adjustGiftCard.mutateAsync({
        id,
        input: { amount: Math.round(Number(adjustAmount) * 100) },
      });
      showToast({ title: "Gift card balance adjusted", tone: "success" });
      setAdjustingId(null);
      setAdjustAmount("");
    } catch {
      showToast({ title: "Could not adjust gift card", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Gift Cards</h1>
        <div className="flex items-center gap-3">
          <Link href="/marketing" className="text-body-sm text-accent-text hover:underline">
            Back to marketing
          </Link>
          <Button onClick={() => setOpen(true)}>New Gift Card</Button>
        </div>
      </div>

      <DataTable
        caption="Gift cards"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No gift cards yet"
        columns={[
          { key: "code", header: "Code", render: (row) => row.code },
          { key: "balance", header: "Balance", render: (row) => money(row.currentBalance) },
          { key: "initial", header: "Initial", render: (row) => money(row.initialBalance) },
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
            render: (row) =>
              adjustingId === row.id ? (
                <div className="flex items-center justify-end gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="+/- ETB"
                    className="w-24 rounded border border-border bg-surface-alt px-2 py-1 text-body-sm text-fg"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjust(row.id)}
                    className="text-caption text-accent-text underline-offset-2 hover:underline"
                  >
                    Apply
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAdjustingId(row.id);
                    setAdjustAmount("");
                  }}
                  className="text-caption text-fg-muted underline-offset-2 hover:underline"
                >
                  Adjust balance
                </button>
              ),
          },
        ]}
      />

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title="New gift card"
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
            label="Initial balance (ETB)"
            type="number"
            min={0}
            step="0.01"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            required
          />
          <Button type="submit" loading={createGiftCard.isPending} disabled={!initialBalance}>
            Create gift card
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
