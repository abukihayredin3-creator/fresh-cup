"use client";

import type { BranchHoursDayInput } from "@fresh-cup/types";
import { Button, Card, Input, Select, Skeleton, Tabs, useToast } from "@fresh-cup/ui";
import { use, useEffect, useState, type FormEvent } from "react";
import {
  useBranch,
  useBranchHours,
  useManagers,
  useSetBranchHours,
  useUpdateBranch,
} from "@/lib/use-branches";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function OverviewTab({ branchId }: { branchId: string }) {
  const { data: branch, isLoading } = useBranch(branchId);
  const { data: managers } = useManagers();
  const updateBranch = useUpdateBranch(branchId);
  const { show: showToast } = useToast();

  const [name, setName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [phone, setPhone] = useState("");
  const [managerId, setManagerId] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!branch) return;
    // eslint-disable-next-line -- populates the edit form once the branch loads
    setName(branch.name);
    setAddressText(branch.addressText);
    setPhone(branch.phone ?? "");
    setManagerId(branch.managerId ?? "");
    setIsActive(branch.isActive);
  }, [branch]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await updateBranch.mutateAsync({
        name,
        addressText,
        phone: phone || undefined,
        managerId: managerId || undefined,
        isActive,
      });
      showToast({ title: "Branch updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update branch", tone: "error" });
    }
  }

  if (isLoading || !branch) {
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="Address"
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          required
        />
        <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Select
          label="Manager"
          placeholder="No manager assigned"
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
          options={(managers?.items ?? []).map((m) => ({ value: m.id, label: m.fullName }))}
        />
        <label className="flex items-center gap-2 text-body-sm text-fg">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Branch is active
        </label>
        <div>
          <Button type="submit" loading={updateBranch.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

function HoursTab({ branchId }: { branchId: string }) {
  const { data: hours, isLoading } = useBranchHours(branchId);
  const setHours = useSetBranchHours(branchId);
  const { show: showToast } = useToast();
  const [days, setDays] = useState<BranchHoursDayInput[]>([]);

  useEffect(() => {
    if (!hours) return;
    const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
    // eslint-disable-next-line -- populates the editor once hours load, filling in defaults for unset days
    setDays(
      Array.from({ length: 7 }, (_, dayOfWeek) => {
        const existing = byDay.get(dayOfWeek);
        return {
          dayOfWeek,
          opensAt: existing?.opensAt ?? "08:00",
          closesAt: existing?.closesAt ?? "20:00",
          isClosed: existing?.isClosed ?? false,
        };
      }),
    );
  }, [hours]);

  function updateDay(dayOfWeek: number, patch: Partial<BranchHoursDayInput>) {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
  }

  async function handleSave() {
    try {
      await setHours.mutateAsync(days);
      showToast({ title: "Hours updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update hours", tone: "error" });
    }
  }

  if (isLoading || days.length === 0) {
    return (
      <Card className="flex flex-col gap-3">
        {Array.from({ length: 7 }, (_, i) => i).map((i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      {days.map((day) => (
        <div key={day.dayOfWeek} className="flex flex-wrap items-center gap-4">
          <span className="w-28 shrink-0 text-body-sm font-medium text-fg">
            {DAY_LABELS[day.dayOfWeek]}
          </span>
          <label className="flex items-center gap-2 text-body-sm text-fg">
            <input
              type="checkbox"
              checked={day.isClosed}
              onChange={(e) => updateDay(day.dayOfWeek, { isClosed: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Closed
          </label>
          {!day.isClosed ? (
            <>
              <input
                type="time"
                value={day.opensAt}
                onChange={(e) => updateDay(day.dayOfWeek, { opensAt: e.target.value })}
                className="rounded border border-border bg-surface-alt px-3 py-2 text-body-sm text-fg"
              />
              <span className="text-fg-muted">to</span>
              <input
                type="time"
                value={day.closesAt}
                onChange={(e) => updateDay(day.dayOfWeek, { closesAt: e.target.value })}
                className="rounded border border-border bg-surface-alt px-3 py-2 text-body-sm text-fg"
              />
            </>
          ) : null}
        </div>
      ))}
      <div>
        <Button onClick={handleSave} loading={setHours.isPending}>
          Save hours
        </Button>
      </div>
    </Card>
  );
}

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState("overview");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h3 text-fg">Branch</h1>
      <Tabs
        label="Branch section"
        items={[
          { id: "overview", label: "Overview" },
          { id: "hours", label: "Hours" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "overview" ? <OverviewTab branchId={id} /> : <HoursTab branchId={id} />}
    </div>
  );
}
