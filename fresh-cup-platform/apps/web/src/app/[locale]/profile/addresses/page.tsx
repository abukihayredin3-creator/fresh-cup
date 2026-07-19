"use client";

import { ApiError } from "@fresh-cup/api-client";
import type { Address } from "@fresh-cup/types";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Skeleton,
  Textarea,
  useToast,
} from "@fresh-cup/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface AddressFormState {
  id: string | null;
  label: string;
  freeText: string;
  isDefault: boolean;
}

const EMPTY_FORM: AddressFormState = { id: null, label: "", freeText: "", isDefault: false };

export default function AddressesPage() {
  const t = useTranslations("addresses");
  const common = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, isReady } = useAuth();

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AddressFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);

  useEffect(() => {
    if (isReady && !user) router.replace("/login?returnTo=%2Fprofile%2Faddresses");
  }, [isReady, user, router]);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.addresses.list(),
    enabled: Boolean(user),
  });

  const saveMutation = useMutation({
    mutationFn: (input: AddressFormState) =>
      input.id
        ? api.addresses.update(input.id, {
            label: input.label,
            freeText: input.freeText,
            isDefault: input.isDefault,
          })
        : api.addresses.create({
            label: input.label,
            freeText: input.freeText,
            isDefault: input.isDefault,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setFormOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (error) => {
      toast.show({
        title:
          error instanceof ApiError
            ? (error.problem?.detail ?? error.message)
            : common("somethingWentWrong"),
        tone: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.addresses.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.show({ title: common("somethingWentWrong"), tone: "error" });
    },
  });

  if (!isReady || !user) {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(address: Address) {
    setForm({
      id: address.id,
      label: address.label,
      freeText: address.freeText,
      isDefault: address.isDefault,
    });
    setFormOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-h3 text-green-900 dark:text-green-700">{t("title")}</h1>
        <Button size="sm" onClick={openCreate}>
          {t("addAddress")}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : addresses.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((address) => (
            <li key={address.id}>
              <Card padded className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-fg">{address.label}</p>
                    {address.isDefault ? <Badge tone="green">{t("default")}</Badge> : null}
                  </div>
                  <p className="mt-1 text-body-sm text-fg-muted">{address.freeText}</p>
                </div>
                <div className="flex gap-1">
                  <IconButton aria-label={t("editAddress")} onClick={() => openEdit(address)}>
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path
                        d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconButton>
                  <IconButton
                    aria-label={t("deleteAddress")}
                    onClick={() => setDeleteTarget(address)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
                      </g>
                    </svg>
                  </IconButton>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? t("editAddress") : t("addAddress")}
        closeLabel={common("close")}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("labelLabel")}
            placeholder={t("labelPlaceholder")}
            value={form.label}
            onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
          />
          <Textarea
            label={t("freeTextLabel")}
            value={form.freeText}
            onChange={(event) =>
              setForm((current) => ({ ...current, freeText: event.target.value }))
            }
            rows={2}
          />
          <label className="flex items-center gap-2 text-body-sm text-fg">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) =>
                setForm((current) => ({ ...current, isDefault: event.target.checked }))
              }
              className="h-4 w-4 accent-orange-600"
            />
            {t("setDefault")}
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {common("cancel")}
            </Button>
            <Button
              loading={saveMutation.isPending}
              disabled={!form.label.trim() || !form.freeText.trim()}
              onClick={() => saveMutation.mutate(form)}
            >
              {common("save")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("deleteAddress")}
        closeLabel={common("close")}
      >
        <p className="mb-4 text-body-sm text-fg-muted">{t("deleteAddressConfirm")}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            {common("cancel")}
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            {t("deleteAddress")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
