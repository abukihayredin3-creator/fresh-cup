import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Region } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { CreateRegionDto } from "./dto/create-region.dto";
import { UpdateRegionDto } from "./dto/update-region.dto";
import { RegionsService } from "./regions.service";

@ApiTags("enterprise-regions")
@ApiBearerAuth()
@Controller("enterprise/regions")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@Auditable("Region")
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  @ApiOperation({ summary: "List regions in the caller's organization" })
  @ApiOkResponse({ isArray: true })
  list(@CurrentOrganization() organizationId: string): Promise<Region[]> {
    return this.regionsService.list(organizationId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a region by id" })
  get(@CurrentOrganization() organizationId: string, @Param("id") id: string): Promise<Region> {
    return this.regionsService.findByIdOrThrow(organizationId, id);
  }

  @Post()
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Create a region (org owner/admin)" })
  create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateRegionDto,
  ): Promise<Region> {
    return this.regionsService.create(organizationId, dto);
  }

  @Patch(":id")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN, OrgRole.REGION_MANAGER)
  @ApiOperation({ summary: "Update a region" })
  update(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateRegionDto,
  ): Promise<Region> {
    return this.regionsService.update(organizationId, id, dto);
  }

  @Delete(":id")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Delete a region (org owner/admin)" })
  delete(@CurrentOrganization() organizationId: string, @Param("id") id: string): Promise<void> {
    return this.regionsService.delete(organizationId, id);
  }

  @Post(":id/branches/:branchId")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN, OrgRole.REGION_MANAGER)
  @ApiOperation({ summary: "Assign a branch to this region" })
  assignBranch(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Param("branchId") branchId: string,
  ): Promise<void> {
    return this.regionsService.assignBranch(organizationId, id, branchId);
  }
}
