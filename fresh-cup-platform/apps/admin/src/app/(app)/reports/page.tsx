"use client";

import { Button, Card, DataTable, Input } from "@fresh-cup/ui";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAuditLogs } from "@/lib/use-audit";
import { downloadCsv } from "@/lib/csv";

const REPORT_LINKS = [
  { href: "/analytics", label: "Sales", description: "Revenue, order volume, and trends" },
  {
    href: "/analytics/products",
    label: "Products",
    description: "Top sellers and item performance",
  },
  {
    href: "/analytics/customers",
    label: "Customers",
    description: "Top spenders and repeat orders",
  },
  {
    href: "/analytics/kitchen",
    label: "Kitchen",
    description: "Prep times and station throughput",
  },
  {
    href: "/analytics/delivery",
    label: "Delivery",
    description: "Delivery times, fees, and heatmap",
  },
  { href: "/inventory/waste-report", label: "Waste", description: "Stock loss by item and cost" },
];

function AuditLogSection() {
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const { data, isLoading } = useAuditLogs({
    entityType: entityType || undefined,
    entityId: entityId || undefined,
    actorUserId: actorUserId || undefined,
  });

  function handleExport() {
    if (!data) return;
    downloadCsv(
      `audit-log-${new Date().toISOString().slice(0, 10)}`,
      data.items.map((log) => ({
        id: log.id,
        actorUserId: log.actorUserId ?? "",
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId ?? "",
        createdAt: log.createdAt,
      })),
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body font-medium text-fg">Audit Log</p>
        <Button
          variant="secondary"
          onClick={handleExport}
          disabled={!data || data.items.length === 0}
        >
          Export CSV
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input
          label="Entity type"
          hideLabel
          placeholder="Entity type (e.g. MenuItem)"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="w-56"
        />
        <Input
          label="Entity ID"
          hideLabel
          placeholder="Entity id"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          className="w-56"
        />
        <Input
          label="Actor user ID"
          hideLabel
          placeholder="Actor user id"
          value={actorUserId}
          onChange={(e) => setActorUserId(e.target.value)}
          className="w-56"
        />
      </div>
      <DataTable
        caption="Audit log entries"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No audit log entries match these filters"
        columns={[
          {
            key: "date",
            header: "Date",
            render: (row) =>
              new Date(row.createdAt).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              }),
          },
          { key: "action", header: "Action", render: (row) => row.action },
          { key: "entityType", header: "Entity", render: (row) => row.entityType },
          { key: "entityId", header: "Entity ID", render: (row) => row.entityId ?? "—" },
          { key: "actor", header: "Actor", render: (row) => row.actorUserId ?? "System" },
        ]}
      />
    </Card>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h3 text-fg">Reports</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="flex flex-col gap-1 transition-colors hover:border-orange-600">
              <p className="text-body font-medium text-fg">{link.label}</p>
              <p className="text-body-sm text-fg-muted">{link.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      {isAdmin ? (
        <AuditLogSection />
      ) : (
        <Card>
          <p className="text-body-sm text-fg-muted">
            The audit log is available to admin accounts only.
          </p>
        </Card>
      )}
    </div>
  );
}
