import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FeatureFlagDefinition, FeatureFlagOverride } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { CreateFeatureFlagDefinitionDto } from "./dto/create-feature-flag-definition.dto";
import { SetFeatureFlagOverrideDto } from "./dto/set-feature-flag-override.dto";
import { FeatureFlagsService } from "./feature-flags.service";

@ApiTags("enterprise-feature-flags")
@ApiBearerAuth()
@Controller("enterprise/feature-flags")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@Auditable("FeatureFlag")
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get("definitions")
  @ApiOperation({ summary: "List every registered feature flag" })
  @ApiOkResponse({ isArray: true })
  listDefinitions(): Promise<FeatureFlagDefinition[]> {
    return this.featureFlagsService.listDefinitions();
  }

  @Post("definitions")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Register a new feature flag key (org owner/admin)" })
  createDefinition(@Body() dto: CreateFeatureFlagDefinitionDto): Promise<FeatureFlagDefinition> {
    return this.featureFlagsService.createDefinition(dto);
  }

  @Get("overrides")
  @ApiOperation({ summary: "List the caller's organization's feature flag overrides" })
  @ApiOkResponse({ isArray: true })
  listOverrides(@CurrentOrganization() organizationId: string): Promise<FeatureFlagOverride[]> {
    return this.featureFlagsService.listOverrides(organizationId);
  }

  @Post("overrides/:key")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Set an override for a feature flag (org owner/admin)" })
  setOverride(
    @CurrentOrganization() organizationId: string,
    @Param("key") key: string,
    @Body() dto: SetFeatureFlagOverrideDto,
  ): Promise<FeatureFlagOverride> {
    return this.featureFlagsService.setOverride(organizationId, key, dto);
  }

  @Get("evaluate/:key")
  @ApiOperation({ summary: "Evaluate a feature flag for the caller's organization" })
  async evaluate(
    @CurrentOrganization() organizationId: string,
    @Param("key") key: string,
    @Query("branchId") branchId?: string,
  ): Promise<{ key: string; enabled: boolean }> {
    const enabled = await this.featureFlagsService.evaluate(organizationId, key, branchId);
    return { key, enabled };
  }
}
