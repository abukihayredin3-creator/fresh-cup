import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Franchise } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { CreateFranchiseDto } from "./dto/create-franchise.dto";
import { UpdateFranchiseDto } from "./dto/update-franchise.dto";
import { FranchisesService } from "./franchises.service";

@ApiTags("enterprise-franchises")
@ApiBearerAuth()
@Controller("enterprise/franchises")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@Auditable("Franchise")
export class FranchisesController {
  constructor(private readonly franchisesService: FranchisesService) {}

  @Get()
  @ApiOperation({ summary: "List franchises in the caller's organization" })
  @ApiOkResponse({ isArray: true })
  list(@CurrentOrganization() organizationId: string): Promise<Franchise[]> {
    return this.franchisesService.list(organizationId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a franchise by id" })
  get(@CurrentOrganization() organizationId: string, @Param("id") id: string): Promise<Franchise> {
    return this.franchisesService.findByIdOrThrow(organizationId, id);
  }

  @Post()
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Create a franchise (org owner/admin)" })
  create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateFranchiseDto,
  ): Promise<Franchise> {
    return this.franchisesService.create(organizationId, dto);
  }

  @Patch(":id")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN, OrgRole.FRANCHISE_ADMIN)
  @ApiOperation({ summary: "Update a franchise" })
  update(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateFranchiseDto,
  ): Promise<Franchise> {
    return this.franchisesService.update(organizationId, id, dto);
  }

  @Post(":id/branches/:branchId")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN, OrgRole.FRANCHISE_ADMIN)
  @ApiOperation({ summary: "Assign a branch to this franchise" })
  assignBranch(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Param("branchId") branchId: string,
  ): Promise<void> {
    return this.franchisesService.assignBranch(organizationId, id, branchId);
  }
}
