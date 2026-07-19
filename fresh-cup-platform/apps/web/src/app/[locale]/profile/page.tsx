"use client";

import { ApiError } from "@fresh-cup/api-client";
import type { Locale } from "@fresh-cup/types";
import { locales } from "@fresh-cup/i18n";
import { Avatar, Button, Card, Dialog, Input, PriceTag, Skeleton, useToast } from "@fresh-cup/ui";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export default function ProfilePage() {
  // next-intl's useLocale() isn't narrowed to our locale union without global module
  // augmentation; routing.ts already constrains it to `locales`.
  const uiLocale = useLocale() as Locale;
  const t = useTranslations("profile");
  const common = useTranslations("common");
  const nav = useTranslations("nav");
  const favoritesT = useTranslations("favorites");
  const ordersT = useTranslations("orders");
  const router = useRouter();
  const toast = useToast();
  const { user, isReady, logout, setUser } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [preferredLocale, setPreferredLocale] = useState<Locale>("en");
  const [saving, setSaving] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    // Seeds the editable form from AuthProvider's user, which itself only resolves post-mount
    // (from localStorage/a refresh call) — there's no synchronous value to derive this from.
    if (!user) return;
    // eslint-disable-next-line -- see comment above
    setFullName(user.fullName);
    setEmail(user.email ?? "");
    setPreferredLocale(user.locale);
  }, [user]);

  const { data: loyalty } = useQuery({
    queryKey: ["loyalty"],
    queryFn: () => api.loyalty.me({ limit: 5 }),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (isReady && !user) router.replace("/login?returnTo=%2Fprofile");
  }, [isReady, user, router]);

  if (!isReady || !user) {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.users.updateMe({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        locale: preferredLocale,
      });
      setUser(updated);
      toast.show({ title: t("profileUpdated"), tone: "success" });
    } catch (error) {
      toast.show({
        title:
          error instanceof ApiError
            ? (error.problem?.detail ?? error.message)
            : common("somethingWentWrong"),
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setConfirmLogout(false);
    await logout();
    router.push("/");
  }

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={user.fullName} size="lg" />
        <div>
          <h1 className="font-display text-h3 text-fg">{t("title")}</h1>
          {user.phone ? <p className="text-body-sm text-fg-muted">{user.phone}</p> : null}
        </div>
      </div>

      <Card padded className="mb-6 flex flex-col gap-4">
        <Input
          label={t("fullNameLabel")}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <Input
          type="email"
          label={t("emailLabel")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-body-sm font-medium text-fg">{t("localeLabel")}</span>
          <select
            value={preferredLocale}
            onChange={(event) => setPreferredLocale(event.target.value as Locale)}
            className="rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
          >
            {locales.map((code) => (
              <option key={code} value={code}>
                {code === "am" ? "አማርኛ" : "English"}
              </option>
            ))}
          </select>
        </label>
        <Button loading={saving} onClick={() => void handleSave()}>
          {t("saveChanges")}
        </Button>
      </Card>

      {loyalty ? (
        <Card padded className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-h5 text-fg">{t("loyaltyBalance")}</h2>
            <PriceTag
              amount={loyalty.balance}
              locale={uiLocale}
              className="text-h5 font-medium text-accent-text"
            />
          </div>
          {loyalty.history.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {loyalty.history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between text-body-sm">
                  <span className="text-fg-muted">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className={entry.pointsDelta >= 0 ? "text-success-text" : "text-danger-text"}
                  >
                    {entry.pointsDelta >= 0 ? "+" : ""}
                    {entry.pointsDelta}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <nav className="mb-6 flex flex-col gap-2">
        <Link
          href="/profile/addresses"
          className="flex items-center justify-between rounded-lg border border-border bg-surface-alt px-4 py-3 text-body-sm font-medium text-fg hover:bg-tint-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
        >
          {t("addresses")}
          <span aria-hidden="true">&rarr;</span>
        </Link>
        <Link
          href="/favorites"
          className="flex items-center justify-between rounded-lg border border-border bg-surface-alt px-4 py-3 text-body-sm font-medium text-fg hover:bg-tint-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
        >
          {favoritesT("title")}
          <span aria-hidden="true">&rarr;</span>
        </Link>
        <Link
          href="/orders"
          className="flex items-center justify-between rounded-lg border border-border bg-surface-alt px-4 py-3 text-body-sm font-medium text-fg hover:bg-tint-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
        >
          {ordersT("title")}
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </nav>

      <Button variant="ghost" onClick={() => setConfirmLogout(true)}>
        {nav("logout")}
      </Button>

      <Dialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title={nav("logout")}
        closeLabel={common("close")}
      >
        <p className="mb-4 text-body-sm text-fg-muted">{t("logoutConfirm")}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmLogout(false)}>
            {common("cancel")}
          </Button>
          <Button variant="danger" onClick={() => void handleLogout()}>
            {nav("logout")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
