import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { AiBrainTenantScopeService } from "../../ai-brain/services/ai-brain-tenant-scope.service";

/**
 * Resolves which branch(es) an AI Copilot request may read, combining two
 * checks the pre-tenancy services this module reuses (ExecutiveService,
 * InventoryIntelligenceService, ...) don't do themselves:
 *
 * 1. The same actor-role branch restriction those services already
 *    enforce internally (MANAGER/STAFF forced to their own branch,
 *    mirroring e.g. ExecutiveService's private `resolveBranchScope`) —
 *    replicated here so a resolved branchId is never silently re-scoped
 *    by the downstream service to something other than what was
 *    requested (which would attribute one branch's data to another's id).
 * 2. Real tenant isolation — a branchId must belong to the caller's
 *    organization — via AiBrainTenantScopeService, since those older
 *    services predate `Organization` and have no isolation of their own.
 */
@Injectable()
export class AiCopilotScopeService {
  constructor(private readonly tenantScope: AiBrainTenantScopeService) {}

  async resolveBranches(
    actor: RequestUser,
    organizationId: string,
    requestedBranchId?: string,
  ): Promise<string[]> {
    if (actor.role === UserRole.MANAGER || actor.role === UserRole.STAFF) {
      return actor.branchId
        ? this.tenantScope.resolveBranchIds(organizationId, actor.branchId)
        : [];
    }
    return this.tenantScope.resolveBranchIds(organizationId, requestedBranchId);
  }
}
