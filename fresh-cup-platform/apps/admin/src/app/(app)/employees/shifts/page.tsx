"use client";

import { Badge, Button, DataTable, Dialog, Select, Tabs, useToast } from "@fresh-cup/ui";
import type { BadgeProps } from "@fresh-cup/ui";
import type { ShiftStatus } from "@fresh-cup/types";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useAttendance, useCreateShift, useEmployees, useShifts } from "@/lib/use-employees";

const STATUS_TONE: Record<ShiftStatus, NonNullable<BadgeProps["tone"]>> = {
  SCHEDULED: "orange",
  COMPLETED: "green",
  MISSED: "error",
  CANCELLED: "neutral",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function ShiftsTab() {
  const { data: shifts, isLoading } = useShifts({});
  const { data: employees } = useEmployees({});
  const { data: branches } = useAdminBranches(true);
  const createShift = useCreateShift();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const employeeById = new Map((employees?.items ?? []).map((e) => [e.id, e.fullName]));
  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createShift.mutateAsync({
        userId,
        branchId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      showToast({ title: "Shift scheduled", tone: "success" });
      setOpen(false);
      setUserId("");
      setBranchId("");
      setStartsAt("");
      setEndsAt("");
    } catch {
      setError("Could not schedule the shift. Check the details and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>Schedule Shift</Button>
      </div>
      <DataTable
        caption="Shifts"
        loading={isLoading}
        rows={shifts?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No shifts scheduled"
        columns={[
          {
            key: "employee",
            header: "Employee",
            render: (row) => employeeById.get(row.userId) ?? row.userId,
          },
          { key: "branch", header: "Branch", render: (row) => branchById.get(row.branchId) ?? "—" },
          { key: "starts", header: "Starts", render: (row) => formatDateTime(row.startsAt) },
          { key: "ends", header: "Ends", render: (row) => formatDateTime(row.endsAt) },
          {
            key: "status",
            header: "Status",
            render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
          },
        ]}
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="Schedule a shift">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {error ? (
            <p
              role="alert"
              className="rounded border border-error-600 bg-error-600/15 px-3 py-2 text-body-sm text-fg"
            >
              {error}
            </p>
          ) : null}
          <Select
            label="Employee"
            placeholder="Select an employee"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            options={(employees?.items ?? []).map((e) => ({ value: e.id, label: e.fullName }))}
          />
          <Select
            label="Branch"
            placeholder="Select a branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Starts at
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              className="rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Ends at
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
              className="rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg"
            />
          </label>
          <Button type="submit" loading={createShift.isPending} disabled={!userId || !branchId}>
            Schedule
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

function AttendanceTab() {
  const { data: attendance, isLoading } = useAttendance({});
  const { data: employees } = useEmployees({});
  const employeeById = new Map((employees?.items ?? []).map((e) => [e.id, e.fullName]));

  return (
    <DataTable
      caption="Attendance"
      loading={isLoading}
      rows={attendance?.items ?? []}
      rowKey={(row) => row.id}
      emptyTitle="No attendance records"
      columns={[
        {
          key: "employee",
          header: "Employee",
          render: (row) => employeeById.get(row.userId) ?? row.userId,
        },
        { key: "clockIn", header: "Clocked in", render: (row) => formatDateTime(row.clockInAt) },
        {
          key: "clockOut",
          header: "Clocked out",
          render: (row) => (row.clockOutAt ? formatDateTime(row.clockOutAt) : "Still clocked in"),
        },
      ]}
    />
  );
}

export default function ShiftsAndAttendancePage() {
  const [tab, setTab] = useState("shifts");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">Shifts &amp; Attendance</h1>
        <Link href="/employees" className="text-body-sm text-accent-text hover:underline">
          Back to employees
        </Link>
      </div>
      <Tabs
        label="Shifts section"
        items={[
          { id: "shifts", label: "Shifts" },
          { id: "attendance", label: "Attendance" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "shifts" ? <ShiftsTab /> : <AttendanceTab />}
    </div>
  );
}
