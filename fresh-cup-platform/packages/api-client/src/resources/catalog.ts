import type { Branch, MenuCategory, MenuItem, PaginatedResult } from "@fresh-cup/types";
import type { ApiClient } from "../client";
import { toQueryString, type PaginationParams } from "../query";

export class CatalogResource {
  constructor(private readonly client: ApiClient) {}

  listBranches(): Promise<Branch[]> {
    return this.client.request("/branches");
  }

  getBranch(id: string): Promise<Branch> {
    return this.client.request(`/branches/${id}`);
  }

  listCategories(branchId: string): Promise<MenuCategory[]> {
    return this.client.request(`/branches/${branchId}/menu-categories`);
  }

  /**
   * Public catalog listing has no server-side text search — a branch's menu
   * is small enough (a few dozen items) that search is done client-side over
   * this list rather than adding a new backend endpoint (see useMenuSearch).
   */
  listMenuItems(
    branchId: string,
    params: PaginationParams & { categoryId?: string } = {},
  ): Promise<PaginatedResult<MenuItem>> {
    return this.client.request(`/branches/${branchId}/menu-items${toQueryString(params)}`);
  }

  getMenuItem(id: string): Promise<MenuItem> {
    return this.client.request(`/menu-items/${id}`);
  }
}
