import type { ListAuditLogsParams } from "@fresh-cup/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";
import type { PaginationParams } from "@fresh-cup/api-client";

export function useAuditLogs(params: PaginationParams & ListAuditLogsParams) {
  return useQuery({
    queryKey: ["admin-audit-logs", params],
    queryFn: () => api.admin.audit.list({ ...params, limit: params.limit ?? 50 }),
  });
}
