import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { EnterpriseAuditLog } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { ChainVerification } from "./enterprise-audit.service";
import { EnterpriseAuditService } from "./enterprise-audit.service";

@ApiTags("enterprise-audit")
@ApiBearerAuth()
@Controller("enterprise/audit-logs")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
export class EnterpriseAuditController {
  constructor(private readonly auditService: EnterpriseAuditService) {}

  @Get()
  @ApiOperation({
    summary: "List the organization's enterprise security audit trail (org owner/admin)",
  })
  @ApiOkResponse({ isArray: true })
  list(
    @CurrentOrganization() organizationId: string,
    @Query("limit") limit?: string,
  ): Promise<EnterpriseAuditLog[]> {
    return this.auditService.list(organizationId, limit ? Number(limit) : undefined);
  }

  @Get("verify")
  @ApiOperation({ summary: "Verify the hash chain has not been tampered with (org owner/admin)" })
  verify(@CurrentOrganization() organizationId: string): Promise<ChainVerification> {
    return this.auditService.verifyChain(organizationId);
  }
}
