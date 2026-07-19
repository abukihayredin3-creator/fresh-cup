import type { AuditLog, ListAuditLogsParams, PaginatedResult } from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminAuditResource {
  constructor(private readonly client: ApiClient) {}

  list(params: PaginationParams & ListAuditLogsParams = {}): Promise<PaginatedResult<AuditLog>> {
    return this.client.request(`/admin/audit-logs${toQueryString(params)}`);
  }
}
