import { Body, Controller, Delete, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { GlobalConfigEntry } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { SetGlobalConfigDto } from "./dto/set-global-config.dto";
import { GlobalConfigService } from "./global-config.service";

@ApiTags("enterprise-global-config")
@ApiBearerAuth()
@Controller("enterprise/global-config")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@Auditable("GlobalConfigEntry")
export class GlobalConfigController {
  constructor(private readonly globalConfigService: GlobalConfigService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's organization's global config entries" })
  @ApiOkResponse({ isArray: true })
  list(@CurrentOrganization() organizationId: string): Promise<GlobalConfigEntry[]> {
    return this.globalConfigService.list(organizationId);
  }

  @Get(":key")
  @ApiOperation({ summary: "Get one config entry's value" })
  async get(
    @CurrentOrganization() organizationId: string,
    @Param("key") key: string,
  ): Promise<{ key: string; value: unknown }> {
    const value = await this.globalConfigService.get(organizationId, key);
    return { key, value: value ?? null };
  }

  @Put(":key")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Set a config entry's value (org owner/admin)" })
  set(
    @CurrentOrganization() organizationId: string,
    @Param("key") key: string,
    @Body() dto: SetGlobalConfigDto,
  ): Promise<GlobalConfigEntry> {
    return this.globalConfigService.set(organizationId, key, dto.value);
  }

  @Delete(":key")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Delete a config entry (org owner/admin)" })
  delete(@CurrentOrganization() organizationId: string, @Param("key") key: string): Promise<void> {
    return this.globalConfigService.delete(organizationId, key);
  }
}
