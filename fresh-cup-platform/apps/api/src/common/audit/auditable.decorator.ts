import { applyDecorators, SetMetadata } from "@nestjs/common";

export const AUDIT_ENTITY_TYPE_KEY = "audit_entity_type";
export const AUDIT_INCLUDE_READS_KEY = "audit_include_reads";

export interface AuditableOptions {
  /**
   * Also audit GET requests on this handler/controller — opt-in only, for
   * the rare read endpoint that has a genuine persisting side effect
   * (e.g. modules/ai-copilot's on-demand briefing/health-score/summary
   * generation, which are GET per its API design but still create rows).
   * Every other `@Auditable(entityType)` call in the codebase is
   * unaffected — GET stays un-audited unless this is explicitly passed.
   */
  auditReads?: boolean;
}

/**
 * Tags a controller (or a single handler) so AuditLogInterceptor records a
 * row for every mutating (POST/PATCH/PUT/DELETE) request it handles — or,
 * with `{ auditReads: true }`, every GET request too. Captures
 * actor/action/entity + the response body as "after" state — see
 * AuditLog in schema.prisma for why there's deliberately no "before" diff.
 */
export function Auditable(
  entityType: string,
  options?: AuditableOptions,
): ClassDecorator & MethodDecorator {
  return options?.auditReads
    ? applyDecorators(
        SetMetadata(AUDIT_ENTITY_TYPE_KEY, entityType),
        SetMetadata(AUDIT_INCLUDE_READS_KEY, true),
      )
    : SetMetadata(AUDIT_ENTITY_TYPE_KEY, entityType);
}
