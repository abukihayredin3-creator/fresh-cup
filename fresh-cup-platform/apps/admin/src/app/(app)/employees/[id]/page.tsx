"use client";

import type { PermissionKey, UserRole } from "@fresh-cup/types";
import { Badge, Button, Card, Select, Skeleton, Tabs, Textarea, useToast } from "@fresh-cup/ui";
import { use, useEffect, useState } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import {
  useCreatePerformanceNote,
  useDepartments,
  useEmployee,
  useGrantPermission,
  usePerformanceNotes,
  usePermissions,
  useRevokePermission,
  useUpdateEmployee,
} from "@/lib/use-employees";
import { ALL_PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";
import { useAuth } from "@/lib/auth-context";

function ProfileTab({ userId }: { userId: string }) {
  const { data: employee, isLoading } = useEmployee(userId);
  const { data: branches } = useAdminBranches(true);
  const { data: departments } = useDepartments();
  const { user: actor } = useAuth();
  const updateEmployee = useUpdateEmployee(userId);
  const { show: showToast } = useToast();

  const [role, setRole] = useState<UserRole>("STAFF");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [salary, setSalary] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!employee) return;
    // eslint-disable-next-line -- populates the edit form once the employee loads
    setRole(employee.role);
    setBranchId(employee.branchId ?? "");
    setDepartmentId(employee.departmentId ?? "");
    setSalary(employee.salary !== null ? String(employee.salary) : "");
    setIsActive(employee.isActive);
    setIsOwner(employee.isOwner);
  }, [employee]);

  const isAdmin = actor?.role === "ADMIN";

  async function handleSave() {
    try {
      await updateEmployee.mutateAsync({
        role,
        branchId: branchId || undefined,
        departmentId: departmentId || undefined,
        isActive,
        ...(isAdmin ? { isOwner, salary: salary.trim() === "" ? undefined : Number(salary) } : {}),
      });
      showToast({ title: "Employee updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update employee", tone: "error" });
    }
  }

  if (isLoading || !employee) {
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-body font-medium text-fg">{employee.fullName}</p>
        <p className="text-body-sm text-fg-muted">{employee.email}</p>
      </div>
      <Select
        label="Role"
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        options={STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
      />
      <Select
        label="Branch"
        placeholder="No branch"
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
      />
      <Select
        label="Department"
        placeholder="No department"
        value={departmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
        options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
      />
      <label className="flex items-center gap-2 text-body-sm text-fg">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Account is active
      </label>
      {isAdmin ? (
        <>
          <label className="flex items-center gap-2 text-body-sm text-fg">
            <input
              type="checkbox"
              checked={isOwner}
              onChange={(e) => setIsOwner(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Owner-level access
          </label>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="salary" className="text-body-sm font-medium text-fg">
              Salary (placeholder, ETB)
            </label>
            <input
              id="salary"
              type="number"
              min={0}
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg"
            />
          </div>
        </>
      ) : null}
      <div>
        <Button onClick={handleSave} loading={updateEmployee.isPending}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}

function PermissionsTab({ userId }: { userId: string }) {
  const { data: permissions, isLoading } = usePermissions(userId);
  const grant = useGrantPermission(userId);
  const revoke = useRevokePermission(userId);
  const [selected, setSelected] = useState<PermissionKey>("MENU_EDIT");

  const grantedKeys = new Set((permissions ?? []).map((p) => p.permission));

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Grant permission"
          value={selected}
          onChange={(e) => setSelected(e.target.value as PermissionKey)}
          options={ALL_PERMISSIONS.filter((p) => !grantedKeys.has(p)).map((p) => ({
            value: p,
            label: PERMISSION_LABELS[p],
          }))}
        />
        <Button onClick={() => grant.mutate(selected)} loading={grant.isPending}>
          Grant
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : !permissions || permissions.length === 0 ? (
        <p className="text-body-sm text-fg-muted">No custom permissions granted.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {permissions.map((permission) => (
            <li key={permission.id} className="flex items-center justify-between gap-3">
              <Badge tone="green">{PERMISSION_LABELS[permission.permission]}</Badge>
              <button
                type="button"
                onClick={() => revoke.mutate(permission.permission)}
                className="text-caption text-fg-muted underline-offset-2 hover:underline"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PerformanceTab({ userId }: { userId: string }) {
  const { data: notes, isLoading } = usePerformanceNotes(userId);
  const createNote = useCreatePerformanceNote(userId);
  const [note, setNote] = useState("");
  const [rating, setRating] = useState("5");

  async function handleAdd() {
    if (!note.trim()) return;
    await createNote.mutateAsync({ note, rating: Number(rating) });
    setNote("");
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Textarea
          label="Add a performance note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex items-end gap-3">
          <Select
            label="Rating"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            options={["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v }))}
            className="w-24"
          />
          <Button onClick={handleAdd} loading={createNote.isPending} disabled={!note.trim()}>
            Add note
          </Button>
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : !notes || notes.length === 0 ? (
        <p className="text-body-sm text-fg-muted">No performance notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((entry) => (
            <li key={entry.id} className="rounded border border-border p-3">
              <div className="flex items-center justify-between">
                <Badge tone="orange">{entry.rating ?? "—"}/5</Badge>
                <span className="text-caption text-fg-muted">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 text-body-sm text-fg">{entry.note}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState("profile");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h3 text-fg">Employee</h1>
      <Tabs
        label="Employee section"
        items={[
          { id: "profile", label: "Profile" },
          { id: "permissions", label: "Permissions" },
          { id: "performance", label: "Performance" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "profile" ? <ProfileTab userId={id} /> : null}
      {tab === "permissions" ? <PermissionsTab userId={id} /> : null}
      {tab === "performance" ? <PerformanceTab userId={id} /> : null}
    </div>
  );
}
