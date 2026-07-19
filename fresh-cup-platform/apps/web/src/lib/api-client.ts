import { createFreshCupClient } from "@fresh-cup/api-client";

/** Module-level so the api client (created once) always reads the latest token. */
let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

export const api = createFreshCupClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  getAccessToken: () => currentAccessToken,
});
