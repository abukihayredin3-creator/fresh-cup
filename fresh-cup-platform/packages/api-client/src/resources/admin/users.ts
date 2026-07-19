import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminUser,
  PaginatedResult,
  UserRole,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminUsersResource {
  constructor(private readonly client: ApiClient) {}

  list(
    params: PaginationParams & { role?: UserRole; branchId?: string } = {},
  ): Promise<PaginatedResult<AdminUser>> {
    return this.client.request(`/admin/users${toQueryString(params)}`);
  }

  get(id: string): Promise<AdminUser> {
    return this.client.request(`/admin/users/${id}`);
  }

  create(input: AdminCreateUserInput): Promise<AdminUser> {
    return this.client.request("/admin/users", { method: "POST", body: JSON.stringify(input) });
  }

  update(id: string, input: AdminUpdateUserInput): Promise<AdminUser> {
    return this.client.request(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }
}
