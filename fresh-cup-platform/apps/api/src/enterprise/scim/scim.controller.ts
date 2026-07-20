import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ScimToken } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Public } from "../../common/decorators/public.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { CreateScimTokenDto } from "./dto/create-scim-token.dto";
import { ScimCreateUserDto } from "./dto/scim-create-user.dto";
import { ScimAuthGuard } from "./scim-auth.guard";
import type { ScimListResponse, ScimPatchOperation, ScimUserResource } from "./scim-user.types";
import { ScimService } from "./scim.service";

@ApiTags("enterprise-scim")
@Controller("enterprise/scim")
export class ScimController {
  constructor(private readonly scimService: ScimService) {}

  // --- Token management (normal JWT auth + org RBAC) ---

  @Get("tokens")
  @ApiBearerAuth()
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @ApiOperation({ summary: "List the caller's organization's SCIM tokens (never the raw token)" })
  @ApiOkResponse({ isArray: true })
  listTokens(@CurrentOrganization() organizationId: string): Promise<ScimToken[]> {
    return this.scimService.listTokens(organizationId);
  }

  @Post("tokens")
  @ApiBearerAuth()
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Create a SCIM provisioning token (org owner/admin) — shown once" })
  createToken(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateScimTokenDto,
  ): Promise<{ id: string; name: string; token: string }> {
    return this.scimService.createToken(organizationId, dto);
  }

  @Delete("tokens/:id")
  @ApiBearerAuth()
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Revoke a SCIM token (org owner/admin)" })
  revokeToken(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.scimService.revokeToken(organizationId, id);
  }

  // --- SCIM 2.0 protocol surface (bearer-token auth via ScimAuthGuard) ---

  @Public()
  @Get("v2/Users")
  @UseGuards(ScimAuthGuard)
  @ApiOperation({ summary: "SCIM: list/filter users" })
  listUsers(
    @CurrentOrganization() organizationId: string,
    @Query("filter") filter?: string,
  ): Promise<ScimListResponse> {
    return this.scimService.listUsers(organizationId, filter);
  }

  @Public()
  @Get("v2/Users/:id")
  @UseGuards(ScimAuthGuard)
  @ApiOperation({ summary: "SCIM: get a user by id" })
  getUser(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ): Promise<ScimUserResource> {
    return this.scimService.getUser(organizationId, id);
  }

  @Public()
  @Post("v2/Users")
  @UseGuards(ScimAuthGuard)
  @ApiOperation({ summary: "SCIM: provision a new user" })
  createUser(
    @CurrentOrganization() organizationId: string,
    @Body() dto: ScimCreateUserDto,
  ): Promise<ScimUserResource> {
    return this.scimService.createUser(organizationId, dto);
  }

  @Public()
  @Put("v2/Users/:id")
  @UseGuards(ScimAuthGuard)
  @ApiOperation({ summary: "SCIM: replace a user" })
  replaceUser(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() dto: ScimCreateUserDto,
  ): Promise<ScimUserResource> {
    return this.scimService.replaceUser(organizationId, id, dto);
  }

  @Public()
  @Patch("v2/Users/:id")
  @UseGuards(ScimAuthGuard)
  @ApiOperation({ summary: "SCIM: partially update a user (active status only)" })
  patchUser(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body("Operations") operations: ScimPatchOperation[],
  ): Promise<ScimUserResource> {
    return this.scimService.patchUser(organizationId, id, operations);
  }

  @Public()
  @Delete("v2/Users/:id")
  @HttpCode(204)
  @UseGuards(ScimAuthGuard)
  @ApiOperation({ summary: "SCIM: deprovision a user (deactivates, does not hard-delete)" })
  deleteUser(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.scimService.deleteUser(organizationId, id);
  }
}
