import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export function useCategories(branchId: string | null) {
  return useQuery({
    queryKey: ["menu-categories", branchId],
    queryFn: () => api.catalog.listCategories(branchId as string),
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });
}

/** Fetches the whole branch menu in one page — no server-side search endpoint exists
 * (see the web app's use-menu.ts), so filtering happens client-side over this list. */
export function useMenuItems(branchId: string | null) {
  return useQuery({
    queryKey: ["menu-items", branchId],
    queryFn: () => api.catalog.listMenuItems(branchId as string, { limit: 100 }),
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });
}

export function useMenuItem(itemId: string) {
  return useQuery({
    queryKey: ["menu-item", itemId],
    queryFn: () => api.catalog.getMenuItem(itemId),
  });
}
