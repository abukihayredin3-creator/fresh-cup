import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { OrganizationResponseDto } from "./dto/organization-response.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationsService } from "./organizations.service";

@ApiTags("enterprise-organizations")
@ApiBearerAuth()
@Controller("enterprise/organizations")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@Auditable("Organization")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get("me")
  @ApiOperation({ summary: "Get the caller's current organization (tenant)" })
  @ApiOkResponse({ type: OrganizationResponseDto })
  async getMine(@CurrentOrganization() organizationId: string): Promise<OrganizationResponseDto> {
    const organization = await this.organizationsService.findByIdOrThrow(organizationId);
    return this.organizationsService.toResponse(organization);
  }

  @Patch("me")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Update the caller's current organization (org owner/admin)" })
  @ApiOkResponse({ type: OrganizationResponseDto })
  async updateMine(
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.organizationsService.update(organizationId, dto);
    return this.organizationsService.toResponse(organization);
  }
}
