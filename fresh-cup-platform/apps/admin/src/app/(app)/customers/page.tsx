"use client";

import { Badge, DataTable } from "@fresh-cup/ui";
import Link from "next/link";
import { useCustomers } from "@/lib/use-customers";

export default function CustomersPage() {
  const { data, isLoading } = useCustomers({});

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h3 text-fg">Customers</h1>

      <DataTable
        caption="Customers"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No customers found"
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link href={`/customers/${row.id}`} className="text-accent-text hover:underline">
                {row.fullName}
              </Link>
            ),
          },
          { key: "email", header: "Email", render: (row) => row.email ?? "—" },
          { key: "phone", header: "Phone", render: (row) => row.phone ?? "—" },
          {
            key: "joined",
            header: "Joined",
            render: (row) => new Date(row.createdAt).toLocaleDateString(),
          },
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
    </div>
  );
}
