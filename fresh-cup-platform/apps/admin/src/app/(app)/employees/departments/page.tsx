"use client";

import { Button, DataTable, Input, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useCreateDepartment, useDepartments, useRemoveDepartment } from "@/lib/use-employees";

export default function DepartmentsPage() {
  const { data, isLoading } = useDepartments();
  const createDepartment = useCreateDepartment();
  const removeDepartment = useRemoveDepartment();
  const { show: showToast } = useToast();
  const [name, setName] = useState("");

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await createDepartment.mutateAsync({ name });
      setName("");
      showToast({ title: "Department created", tone: "success" });
    } catch {
      showToast({ title: "Could not create department", tone: "error" });
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeDepartment.mutateAsync(id);
      showToast({ title: "Department removed", tone: "success" });
    } catch {
      showToast({ title: "Could not remove department", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">Departments</h1>
        <Link href="/employees" className="text-body-sm text-accent-text hover:underline">
          Back to employees
        </Link>
      </div>

      <form onSubmit={handleCreate} className="flex items-end gap-3">
        <Input label="New department name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" loading={createDepartment.isPending} disabled={!name.trim()}>
          Add
        </Button>
      </form>

      <DataTable
        caption="Departments"
        loading={isLoading}
        rows={data ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No departments yet"
        columns={[
          { key: "name", header: "Name", render: (row) => row.name },
          {
            key: "actions",
            header: "",
            align: "end",
            render: (row) => (
              <button
                type="button"
                onClick={() => handleRemove(row.id)}
                className="text-caption text-danger-text underline-offset-2 hover:underline"
              >
                Remove
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
