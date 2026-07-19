"use client";

import { ApiError } from "@fresh-cup/api-client";
import { Spinner } from "@fresh-cup/ui";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import { useBranch } from "@/lib/branch-context";
import { useDineInTable } from "@/lib/table-context";

export default function TableQrPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = use(params);
  const common = useTranslations("common");
  const router = useRouter();
  const { setBranchId } = useBranch();
  const { setTable } = useDineInTable();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.tables
      .resolve(qrToken)
      .then((result) => {
        if (cancelled) return;
        setBranchId(result.branchId);
        setTable({
          tableId: result.tableId,
          tableLabel: result.tableLabel,
          branchId: result.branchId,
        });
        router.replace("/menu");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? (err.problem?.detail ?? err.message)
            : common("somethingWentWrong"),
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line -- resolve once for this qrToken
  }, [qrToken]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {error ? (
        <>
          <p className="font-display text-h4 text-fg">{common("somethingWentWrong")}</p>
          <p className="text-body-sm text-fg-muted">{error}</p>
        </>
      ) : (
        <>
          <Spinner size="lg" label={common("loading")} />
          <p className="text-body-sm text-fg-muted">{common("loading")}</p>
        </>
      )}
    </div>
  );
}
