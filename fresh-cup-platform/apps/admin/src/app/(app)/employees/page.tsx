"use client";

import type { UserRole } from "@fresh-cup/types";
import { Badge, Button, DataTable, Dialog, Input, Select, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useCreateEmployee, useEmployees } from "@/lib/use-employees";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";

export default function EmployeesPage() {
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const { data, isLoading } = useEmployees({ role: roleFilter || undefined });
  const { data: branches } = useAdminBranches(true);
  const createEmployee = useCreateEmployee();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("STAFF");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("STAFF");
    setBranchId("");
    setError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createEmployee.mutateAsync({
        email,
        password,
        fullName,
        role,
        branchId: branchId || undefined,
      });
      showToast({ title: "Employee created", tone: "success" });
      setOpen(false);
      resetForm();
    } catch {
      setError("Could not create the employee. Check the details and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Employees</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/employees/departments"
            className="text-body-sm text-accent-text hover:underline"
          >
            Departments
          </Link>
          <Link href="/employees/shifts" className="text-body-sm text-accent-text hover:underline">
            Shifts &amp; Attendance
          </Link>
          <Button onClick={() => setOpen(true)}>New Employee</Button>
        </div>
      </div>

      <Select
        label="Filter by role"
        hideLabel
        placeholder="All roles"
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
        options={STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        className="w-56"
      />

      <DataTable
        caption="Employees"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No employees found"
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link href={`/employees/${row.id}`} className="text-accent-text hover:underline">
                {row.fullName}
              </Link>
            ),
          },
          { key: "email", header: "Email", render: (row) => row.email ?? "—" },
          { key: "role", header: "Role", render: (row) => ROLE_LABELS[row.role] },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge tone={row.isActive ? "green" : "neutral"}>
                {row.isActive ? "Active" : "Inactive"}
              </Badge>
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
        title="New employee"
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
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="Minimum 8 characters"
            required
          />
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
          <Button type="submit" loading={createEmployee.isPending}>
            Create employee
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
