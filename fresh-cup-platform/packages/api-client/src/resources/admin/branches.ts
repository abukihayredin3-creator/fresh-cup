import type {
  Branch,
  BranchHours,
  BranchHoursDayInput,
  CreateBranchInput,
  UpdateBranchInput,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";

export class AdminBranchesResource {
  constructor(private readonly client: ApiClient) {}

  /** All branches, including inactive ones — the public `/branches` list omits those. */
  listAll(): Promise<Branch[]> {
    return this.client.request("/branches/admin/all");
  }

  get(id: string): Promise<Branch> {
    return this.client.request(`/branches/${id}`);
  }

  create(input: CreateBranchInput): Promise<Branch> {
    return this.client.request("/branches", { method: "POST", body: JSON.stringify(input) });
  }

  update(id: string, input: UpdateBranchInput): Promise<Branch> {
    return this.client.request(`/branches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  getHours(id: string): Promise<BranchHours[]> {
    return this.client.request(`/branches/${id}/hours`);
  }

  setHours(id: string, days: BranchHoursDayInput[]): Promise<BranchHours[]> {
    return this.client.request(`/branches/${id}/hours`, {
      method: "PUT",
      body: JSON.stringify({ days }),
    });
  }
}
