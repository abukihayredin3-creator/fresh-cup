import { SetMetadata } from "@nestjs/common";

export const AUDIT_ENTITY_TYPE_KEY = "audit_entity_type";

/**
 * Tags a controller (or a single handler) so AuditLogInterceptor records a
 * row for every mutating (POST/PATCH/PUT/DELETE) request it handles.
 * Captures actor/action/entity + the response body as "after" state — see
 * AuditLog in schema.prisma for why there's deliberately no "before" diff.
 */
export const Auditable = (entityType: string) => SetMetadata(AUDIT_ENTITY_TYPE_KEY, entityType);
