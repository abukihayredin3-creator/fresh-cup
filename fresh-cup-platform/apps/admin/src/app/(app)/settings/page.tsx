"use client";

import type { Locale } from "@fresh-cup/types";
import { Button, Card, Input, Select, Skeleton, useToast } from "@fresh-cup/ui";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSettings, useUpdateSettings } from "@/lib/use-settings";

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { show: showToast } = useToast();

  const [restaurantName, setRestaurantName] = useState("");
  const [defaultLocale, setDefaultLocale] = useState<Locale>("en");
  const [defaultCurrency, setDefaultCurrency] = useState("");
  const [defaultTaxPercent, setDefaultTaxPercent] = useState("0");
  const [timezone, setTimezone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColorHex, setPrimaryColorHex] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  useEffect(() => {
    if (!settings) return;
    // eslint-disable-next-line -- populates the edit form once settings load
    setRestaurantName(settings.restaurantName);
    setDefaultLocale(settings.defaultLocale);
    setDefaultCurrency(settings.defaultCurrency);
    setDefaultTaxPercent(String(settings.defaultTaxPercent));
    setTimezone(settings.timezone);
    setLogoUrl(settings.logoUrl ?? "");
    setPrimaryColorHex(settings.primaryColorHex ?? "");
    setSupportEmail(settings.supportEmail ?? "");
    setSupportPhone(settings.supportPhone ?? "");
    setEmailNotifications(settings.emailNotifications);
    setSmsNotifications(settings.smsNotifications);
    setPushNotifications(settings.pushNotifications);
  }, [settings]);

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({
        restaurantName,
        defaultLocale,
        defaultCurrency,
        defaultTaxPercent: Number(defaultTaxPercent),
        timezone,
        logoUrl: logoUrl || undefined,
        primaryColorHex: primaryColorHex || undefined,
        supportEmail: supportEmail || undefined,
        supportPhone: supportPhone || undefined,
        emailNotifications,
        smsNotifications,
        pushNotifications,
      });
      showToast({ title: "Settings saved", tone: "success" });
    } catch {
      showToast({ title: "Could not save settings", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h3 text-fg">Settings</h1>

      {isLoading || !settings ? (
        <Card className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          {!isAdmin ? (
            <p className="text-body-sm text-fg-muted">
              Settings are read-only for your role — only admins can save changes.
            </p>
          ) : null}
          <fieldset disabled={!isAdmin} className="flex flex-col gap-4">
            <Input
              label="Restaurant name"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              required
            />
            <div className="flex gap-3">
              <Select
                label="Default locale"
                value={defaultLocale}
                onChange={(e) => setDefaultLocale(e.target.value as Locale)}
                options={[
                  { value: "en", label: "English" },
                  { value: "am", label: "Amharic" },
                ]}
              />
              <Input
                label="Default currency"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Input
                label="Default tax (%)"
                type="number"
                min={0}
                step="0.01"
                value={defaultTaxPercent}
                onChange={(e) => setDefaultTaxPercent(e.target.value)}
              />
              <Input
                label="Timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
            <Input label="Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            <Input
              label="Primary color (hex)"
              value={primaryColorHex}
              onChange={(e) => setPrimaryColorHex(e.target.value)}
            />
            <div className="flex gap-3">
              <Input
                label="Support email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
              />
              <Input
                label="Support phone"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-body-sm font-medium text-fg">Notification channels</p>
              <label className="flex items-center gap-2 text-body-sm text-fg">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Email
              </label>
              <label className="flex items-center gap-2 text-body-sm text-fg">
                <input
                  type="checkbox"
                  checked={smsNotifications}
                  onChange={(e) => setSmsNotifications(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                SMS
              </label>
              <label className="flex items-center gap-2 text-body-sm text-fg">
                <input
                  type="checkbox"
                  checked={pushNotifications}
                  onChange={(e) => setPushNotifications(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Push
              </label>
            </div>
            <div>
              <Button onClick={handleSave} loading={updateSettings.isPending}>
                Save settings
              </Button>
            </div>
          </fieldset>
        </Card>
      )}
    </div>
  );
}
