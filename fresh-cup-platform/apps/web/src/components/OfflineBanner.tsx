"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const t = useTranslations("common");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // navigator.onLine is unavailable during SSR; hydrated post-mount, then kept in
    // sync by the online/offline events for the rest of the session.
    // eslint-disable-next-line -- see comment above
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="bg-orange-600 px-4 py-2 text-center text-caption font-medium text-neutral-900"
    >
      {t("offlineBanner")}
    </div>
  );
}
