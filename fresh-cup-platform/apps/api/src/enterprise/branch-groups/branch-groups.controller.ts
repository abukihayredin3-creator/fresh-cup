import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { BranchGroup } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { BranchGroupsService } from "./branch-groups.service";
import { CreateBranchGroupDto } from "./dto/create-branch-group.dto";

@ApiTags("enterprise-branch-groups")
@ApiBearerAuth()
@Controller("enterprise/branch-groups")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@Auditable("BranchGroup")
export class BranchGroupsController {
  constructor(private readonly branchGroupsService: BranchGroupsService) {}

  @Get()
  @ApiOperation({ summary: "List branch groups in the caller's organization" })
  @ApiOkResponse({ isArray: true })
  list(@CurrentOrganization() organizationId: string): Promise<BranchGroup[]> {
    return this.branchGroupsService.list(organizationId);
  }

  @Get(":id/branches")
  @ApiOperation({ summary: "List branch ids in this group" })
  listBranches(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ): Promise<string[]> {
    return this.branchGroupsService.listBranches(organizationId, id);
  }

  @Post()
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Create a branch group (org owner/admin)" })
  create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateBranchGroupDto,
  ): Promise<BranchGroup> {
    return this.branchGroupsService.create(organizationId, dto);
  }

  @Delete(":id")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Delete a branch group (org owner/admin)" })
  delete(@CurrentOrganization() organizationId: string, @Param("id") id: string): Promise<void> {
    return this.branchGroupsService.delete(organizationId, id);
  }

  @Post(":id/branches/:branchId")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Add a branch to this group" })
  addBranch(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Param("branchId") branchId: string,
  ): Promise<void> {
    return this.branchGroupsService.addBranch(organizationId, id, branchId);
  }

  @Delete(":id/branches/:branchId")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Remove a branch from this group" })
  removeBranch(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Param("branchId") branchId: string,
  ): Promise<void> {
    return this.branchGroupsService.removeBranch(organizationId, id, branchId);
  }
}
