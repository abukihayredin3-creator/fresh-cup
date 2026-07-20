import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { IpAllowlistEntry } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { CreateIpAllowlistEntryDto } from "./dto/create-ip-allowlist-entry.dto";
import { IpAllowlistService } from "./ip-allowlist.service";

@ApiTags("enterprise-ip-allowlist")
@ApiBearerAuth()
@Controller("enterprise/ip-allowlist")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@Auditable("IpAllowlistEntry")
export class IpAllowlistController {
  constructor(private readonly ipAllowlistService: IpAllowlistService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's organization's IP allowlist" })
  @ApiOkResponse({ isArray: true })
  list(@CurrentOrganization() organizationId: string): Promise<IpAllowlistEntry[]> {
    return this.ipAllowlistService.list(organizationId);
  }

  @Post()
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Add an IP allowlist entry (org owner/admin)" })
  create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateIpAllowlistEntryDto,
  ): Promise<IpAllowlistEntry> {
    return this.ipAllowlistService.create(organizationId, dto);
  }

  @Delete(":id")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Remove an IP allowlist entry (org owner/admin)" })
  delete(@CurrentOrganization() organizationId: string, @Param("id") id: string): Promise<void> {
    return this.ipAllowlistService.delete(organizationId, id);
  }
}
