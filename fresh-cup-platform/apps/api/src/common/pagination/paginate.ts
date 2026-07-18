import type { PaginatedResult } from "@fresh-cup/types";

interface PageArgs {
  take: number;
  cursor?: { id: string };
  skip?: number;
}

/**
 * Shared cursor-pagination helper (see docs/API_DESIGN.md — cursor-based
 * pagination on every list endpoint). Fetches one extra row to know
 * whether a next page exists without a separate count query.
 */
export async function paginate<T extends { id: string }>(
  fetchPage: (args: PageArgs) => Promise<T[]>,
  { cursor, limit }: { cursor?: string; limit: number },
): Promise<PaginatedResult<T>> {
  const take = limit + 1;
  const items = await fetchPage({
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const last = page[page.length - 1];

  return {
    items: page,
    nextCursor: hasMore && last ? last.id : null,
  };
}
