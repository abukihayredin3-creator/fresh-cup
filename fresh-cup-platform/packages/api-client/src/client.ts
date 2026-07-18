import type { ProblemDetails } from "@fresh-cup/types";

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetails | undefined,
  ) {
    super(problem?.title ?? `Request failed with status ${status}`);
    this.name = "ApiError";
  }
}

/**
 * Thin, dependency-free fetch wrapper shared by every Fresh Cup frontend.
 *
 * This is the transport layer only. Once apps/api ships its first endpoints
 * and OpenAPI spec (Phase 1), resource methods (`orders.create`, `menu.list`,
 * ...) are generated on top of this client rather than hand-written here.
 */
export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.options.getAccessToken?.();
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const problem = (await response.json().catch(() => undefined)) as ProblemDetails | undefined;
      throw new ApiError(response.status, problem);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
