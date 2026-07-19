"use client";

import { useEffect } from "react";

/** Registers the offline-caching service worker. Production only — hot reload during
 * development fights a service worker's own caching, so it stays off in dev. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline caching is a progressive enhancement — a failed registration
      // (unsupported browser, blocked by an extension, ...) shouldn't break the app.
    });
  }, []);

  return null;
}
