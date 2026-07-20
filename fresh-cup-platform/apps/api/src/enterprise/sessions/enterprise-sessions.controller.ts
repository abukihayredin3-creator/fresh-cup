import { Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { OrgSession } from "./enterprise-sessions.service";
import { EnterpriseSessionsService } from "./enterprise-sessions.service";

@ApiTags("enterprise-sessions")
@ApiBearerAuth()
@Controller("enterprise/sessions")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
@Auditable("Session")
export class EnterpriseSessionsController {
  constructor(private readonly sessionsService: EnterpriseSessionsService) {}

  @Get()
  @ApiOperation({ summary: "List active sessions across the organization (org owner/admin)" })
  @ApiOkResponse({ isArray: true })
  list(@CurrentOrganization() organizationId: string): Promise<OrgSession[]> {
    return this.sessionsService.listOrgSessions(organizationId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Revoke one session (org owner/admin)" })
  revoke(@CurrentOrganization() organizationId: string, @Param("id") id: string): Promise<void> {
    return this.sessionsService.revokeSession(organizationId, id);
  }

  @Post("users/:userId/revoke-all")
  @ApiOperation({ summary: "Force-logout a user everywhere (org owner/admin)" })
  revokeAllForUser(
    @CurrentOrganization() organizationId: string,
    @Param("userId") userId: string,
  ): Promise<void> {
    return this.sessionsService.revokeAllForUser(organizationId, userId);
  }
}
