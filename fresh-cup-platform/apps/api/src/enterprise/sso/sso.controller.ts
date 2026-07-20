import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { SsoConnection } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Public } from "../../common/decorators/public.decorator";
import type { TokenPair } from "../../modules/auth/token.service";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { CreateSsoConnectionDto } from "./dto/create-sso-connection.dto";
import { SsoOidcCallbackDto, SsoSamlCallbackDto } from "./dto/sso-callback.dto";
import { SsoService } from "./sso.service";

@ApiTags("enterprise-sso")
@Controller("enterprise/sso")
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get("connections")
  @ApiBearerAuth()
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @ApiOperation({ summary: "List the caller's organization's SSO connections" })
  @ApiOkResponse({ isArray: true })
  listConnections(@CurrentOrganization() organizationId: string): Promise<SsoConnection[]> {
    return this.ssoService.listConnections(organizationId);
  }

  @Post("connections")
  @ApiBearerAuth()
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Configure a new SSO connection (org owner/admin)" })
  createConnection(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateSsoConnectionDto,
  ): Promise<SsoConnection> {
    return this.ssoService.createConnection(organizationId, dto);
  }

  // Everything below is pre-authentication — it IS how a user logs in, so
  // it cannot require the global JwtAuthGuard. organizationId is a plain
  // route param instead of the resolved-from-token value, the same way a
  // customer-facing "sign in with SSO" button would know which org it's
  // pointed at (subdomain or a slug picker), not from a session that
  // doesn't exist yet.
  @Public()
  @Get(":organizationId/:connectionId/authorize")
  @ApiOperation({ summary: "Get the IdP authorization URL to redirect the browser to" })
  initiate(
    @Param("organizationId") organizationId: string,
    @Param("connectionId") connectionId: string,
    @Query("redirectUri") redirectUri: string,
  ): Promise<{ authorizationUrl: string }> {
    return this.ssoService.initiate(organizationId, connectionId, redirectUri);
  }

  @Public()
  @Post(":organizationId/:connectionId/callback/oidc")
  @ApiOperation({ summary: "Complete an OIDC login and receive a token pair" })
  handleOidcCallback(
    @Param("organizationId") organizationId: string,
    @Param("connectionId") connectionId: string,
    @Body() dto: SsoOidcCallbackDto,
  ): Promise<TokenPair> {
    return this.ssoService.handleOidcCallback(organizationId, connectionId, dto);
  }

  @Public()
  @Post(":organizationId/:connectionId/callback/saml")
  @ApiOperation({ summary: "Complete a SAML login and receive a token pair" })
  handleSamlCallback(
    @Param("organizationId") organizationId: string,
    @Param("connectionId") connectionId: string,
    @Body() dto: SsoSamlCallbackDto,
  ): Promise<TokenPair> {
    return this.ssoService.handleSamlCallback(organizationId, connectionId, dto);
  }
}
