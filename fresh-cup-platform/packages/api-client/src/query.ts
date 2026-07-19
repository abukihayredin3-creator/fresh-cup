/** Builds a `?a=1&b=2` query string, skipping undefined/null/empty values. */
export function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}
