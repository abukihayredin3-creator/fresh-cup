import { createFreshCupClient } from "@fresh-cup/api-client";

/** Module-level so the api client (created once) always reads the latest token. */
let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export const api = createFreshCupClient({
  baseUrl: apiBaseUrl,
  getAccessToken: () => currentAccessToken,
});

/** The bare server origin (no /api/v1 prefix) — Nest WebSocket gateways aren't under the REST global prefix. */
export const apiOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, "");
