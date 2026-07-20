"use client";

import { Button, Card, Input, Select, StatCard, useToast } from "@fresh-cup/ui";
import type { EnterpriseLocale } from "@fresh-cup/types";
import { useEffect, useState } from "react";
import {
  useCorporateDashboard,
  useOrganization,
  useUpdateOrganization,
} from "@/lib/use-enterprise";

const LOCALE_OPTIONS: { value: EnterpriseLocale; label: string }[] = [
  { value: "EN", label: "English" },
  { value: "AM", label: "Amharic" },
];

function formatMinor(minor: number): string {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EnterpriseOverviewPage() {
  const { data: organization, isLoading } = useOrganization();
  const { data: dashboard, isLoading: isDashboardLoading } = useCorporateDashboard();
  const updateOrganization = useUpdateOrganization();
  const { show: showToast } = useToast();

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [defaultLocale, setDefaultLocale] = useState<EnterpriseLocale>("EN");
  const [defaultCurrencyCode, setDefaultCurrencyCode] = useState("");

  useEffect(() => {
    if (!organization) return;
    // eslint-disable-next-line -- populates the edit form once the organization loads
    setName(organization.name);
    setTimezone(organization.timezone);
    setDefaultLocale(organization.defaultLocale);
    setDefaultCurrencyCode(organization.defaultCurrencyCode);
  }, [organization]);

  async function handleSave() {
    try {
      await updateOrganization.mutateAsync({ name, timezone, defaultLocale, defaultCurrencyCode });
      showToast({ title: "Organization updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update organization", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Branches" value={organization?.branchCount ?? "—"} loading={isLoading} />
        <StatCard label="Status" value={organization?.status ?? "—"} loading={isLoading} />
        <StatCard
          label="Corporate revenue (30d)"
          value={
            dashboard
              ? `${formatMinor(dashboard.totalRevenueMinor)} ${organization?.defaultCurrencyCode ?? ""}`
              : "—"
          }
          loading={isDashboardLoading}
        />
        <StatCard
          label="Corporate orders (30d)"
          value={dashboard?.totalOrders ?? "—"}
          loading={isDashboardLoading}
        />
      </div>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Organization settings</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            hint="IANA timezone, e.g. Africa/Addis_Ababa"
          />
          <Select
            label="Default locale"
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value as EnterpriseLocale)}
            options={LOCALE_OPTIONS}
          />
          <Input
            label="Default currency code"
            value={defaultCurrencyCode}
            onChange={(e) => setDefaultCurrencyCode(e.target.value.toUpperCase())}
            hint="ISO 4217, e.g. ETB"
          />
        </div>
        <div className="mt-4">
          <Button onClick={handleSave} loading={updateOrganization.isPending}>
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
