export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  after: unknown;
  createdAt: string;
}

export interface ListAuditLogsParams {
  entityType?: string;
  actorUserId?: string;
  entityId?: string;
}
