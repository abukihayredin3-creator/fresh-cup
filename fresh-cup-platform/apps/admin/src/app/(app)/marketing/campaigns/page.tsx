"use client";

import { Badge, Button, DataTable, Dialog, Input, Select, Textarea, useToast } from "@fresh-cup/ui";
import type { BadgeProps } from "@fresh-cup/ui";
import type { CampaignChannel, CampaignSegment, CampaignStatus } from "@fresh-cup/types";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  useCampaigns,
  useCancelCampaign,
  useCreateCampaign,
  useSendCampaign,
} from "@/lib/use-marketing";

const STATUS_TONE: Record<CampaignStatus, NonNullable<BadgeProps["tone"]>> = {
  DRAFT: "neutral",
  SCHEDULED: "orange",
  SENT: "green",
  CANCELLED: "error",
};

export default function CampaignsPage() {
  const [status, setStatus] = useState<CampaignStatus | "">("");
  const { data, isLoading } = useCampaigns({ status: status || undefined });
  const createCampaign = useCreateCampaign();
  const sendCampaign = useSendCampaign();
  const cancelCampaign = useCancelCampaign();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("PUSH");
  const [message, setMessage] = useState("");
  const [targetSegment, setTargetSegment] = useState<CampaignSegment>("ALL_CUSTOMERS");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setChannel("PUSH");
    setMessage("");
    setTargetSegment("ALL_CUSTOMERS");
    setError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createCampaign.mutateAsync({ name, channel, message, targetSegment });
      showToast({ title: "Campaign created", tone: "success" });
      setOpen(false);
      resetForm();
    } catch {
      setError("Could not create the campaign. Check the details and try again.");
    }
  }

  async function handleSend(id: string) {
    try {
      await sendCampaign.mutateAsync(id);
      showToast({ title: "Campaign sent", tone: "success" });
    } catch {
      showToast({ title: "Could not send campaign", tone: "error" });
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelCampaign.mutateAsync(id);
      showToast({ title: "Campaign cancelled", tone: "success" });
    } catch {
      showToast({ title: "Could not cancel campaign", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Campaigns</h1>
        <div className="flex items-center gap-3">
          <Link href="/marketing" className="text-body-sm text-accent-text hover:underline">
            Back to marketing
          </Link>
          <Button onClick={() => setOpen(true)}>New Campaign</Button>
        </div>
      </div>

      <Select
        label="Filter by status"
        hideLabel
        placeholder="All statuses"
        value={status}
        onChange={(e) => setStatus(e.target.value as CampaignStatus | "")}
        options={[
          { value: "DRAFT", label: "Draft" },
          { value: "SCHEDULED", label: "Scheduled" },
          { value: "SENT", label: "Sent" },
          { value: "CANCELLED", label: "Cancelled" },
        ]}
        className="w-56"
      />

      <DataTable
        caption="Campaigns"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No campaigns yet"
        columns={[
          { key: "name", header: "Name", render: (row) => row.name },
          { key: "channel", header: "Channel", render: (row) => row.channel },
          { key: "segment", header: "Segment", render: (row) => row.targetSegment },
          {
            key: "status",
            header: "Status",
            render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
          },
          { key: "recipients", header: "Recipients", render: (row) => row.recipientCount ?? "—" },
          {
            key: "actions",
            header: "",
            align: "end",
            render: (row) => (
              <div className="flex items-center justify-end gap-3">
                {row.status === "DRAFT" || row.status === "SCHEDULED" ? (
                  <button
                    type="button"
                    onClick={() => handleSend(row.id)}
                    className="text-caption text-accent-text underline-offset-2 hover:underline"
                  >
                    Send
                  </button>
                ) : null}
                {row.status === "DRAFT" || row.status === "SCHEDULED" ? (
                  <button
                    type="button"
                    onClick={() => handleCancel(row.id)}
                    className="text-caption text-danger-text underline-offset-2 hover:underline"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="New campaign"
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
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select
            label="Channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as CampaignChannel)}
            options={[
              { value: "PUSH", label: "Push notification" },
              { value: "EMAIL", label: "Email" },
              { value: "SMS", label: "SMS" },
            ]}
          />
          <Select
            label="Target segment"
            value={targetSegment}
            onChange={(e) => setTargetSegment(e.target.value as CampaignSegment)}
            options={[
              { value: "ALL_CUSTOMERS", label: "All customers" },
              { value: "ACTIVE_CUSTOMERS", label: "Active customers" },
              { value: "INACTIVE_CUSTOMERS", label: "Inactive customers" },
              { value: "VIP_CUSTOMERS", label: "VIP customers" },
            ]}
          />
          <Textarea
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
          <Button
            type="submit"
            loading={createCampaign.isPending}
            disabled={!name.trim() || !message.trim()}
          >
            Create campaign
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
