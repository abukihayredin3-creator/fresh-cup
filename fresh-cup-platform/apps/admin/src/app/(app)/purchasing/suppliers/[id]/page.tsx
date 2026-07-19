"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Button, Card, Input, Skeleton, StatCard, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useSupplier, useSupplierAnalytics, useUpdateSupplier } from "@/lib/use-purchasing";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

function DetailsCard({ supplierId }: { supplierId: string }) {
  const { data: supplier, isLoading } = useSupplier(supplierId);
  const updateSupplier = useUpdateSupplier(supplierId);
  const { show: showToast } = useToast();

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!supplier) return;
    // eslint-disable-next-line -- populates the edit form once the supplier loads
    setName(supplier.name);
    setContactName(supplier.contactName ?? "");
    setPhone(supplier.phone ?? "");
    setEmail(supplier.email ?? "");
    setAddress(supplier.address ?? "");
    setIsActive(supplier.isActive);
  }, [supplier]);

  async function handleSave() {
    try {
      await updateSupplier.mutateAsync({
        name,
        contactName: contactName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        isActive,
      });
      showToast({ title: "Supplier updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update supplier", tone: "error" });
    }
  }

  if (isLoading || !supplier) {
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input
        label="Contact name"
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
      />
      <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <label className="flex items-center gap-2 text-body-sm text-fg">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Active
      </label>
      <div>
        <Button onClick={handleSave} loading={updateSupplier.isPending}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}

function AnalyticsGrid({ supplierId }: { supplierId: string }) {
  const { data, isLoading } = useSupplierAnalytics(supplierId);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <StatCard label="Total orders" value={data?.totalOrders ?? "—"} loading={isLoading} />
      <StatCard label="Received orders" value={data?.receivedOrders ?? "—"} loading={isLoading} />
      <StatCard label="Cancelled orders" value={data?.cancelledOrders ?? "—"} loading={isLoading} />
      <StatCard
        label="Total spend"
        value={data ? money(data.totalSpend) : "—"}
        loading={isLoading}
      />
      <StatCard label="Total paid" value={data ? money(data.totalPaid) : "—"} loading={isLoading} />
      <StatCard
        label="Avg lead time"
        value={
          data?.avgLeadTimeDays !== null && data?.avgLeadTimeDays !== undefined
            ? `${data.avgLeadTimeDays.toFixed(1)}d`
            : "—"
        }
        loading={isLoading}
      />
      <StatCard
        label="Fulfillment rate"
        value={data ? `${(data.fulfillmentRate * 100).toFixed(0)}%` : "—"}
        loading={isLoading}
      />
    </div>
  );
}

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: supplier } = useSupplier(id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">{supplier?.name ?? "Supplier"}</h1>
        <Link
          href="/purchasing/suppliers"
          className="text-body-sm text-accent-text hover:underline"
        >
          Back to suppliers
        </Link>
      </div>
      <AnalyticsGrid supplierId={id} />
      <DetailsCard supplierId={id} />
    </div>
  );
}
