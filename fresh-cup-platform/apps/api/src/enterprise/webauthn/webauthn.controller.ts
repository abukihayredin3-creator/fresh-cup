import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { WebAuthnCredential } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { TokenPair } from "../../modules/auth/token.service";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { VerifyWebAuthnAssertionDto } from "./dto/webauthn-assertion.dto";
import { VerifyWebAuthnRegistrationDto } from "./dto/webauthn-registration.dto";
import { WebAuthnService } from "./webauthn.service";

/**
 * WebAuthn here is a step-up MFA factor for an already-authenticated
 * session (register a key while logged in, assert it to prove
 * possession), not a passwordless primary-login replacement — see
 * WebAuthnService's docblock. Every route requires the normal JWT auth
 * (no `@Public()`), which is also what avoids needing to model a
 * "who is this WebAuthn assertion for" lookup before any identity exists.
 */
@ApiTags("enterprise-webauthn")
@ApiBearerAuth()
@Controller("enterprise/webauthn")
@UseGuards(TenantContextGuard)
export class WebAuthnController {
  constructor(private readonly webAuthnService: WebAuthnService) {}

  @Get("credentials")
  @ApiOperation({ summary: "List the caller's registered hardware security keys" })
  @ApiOkResponse({ isArray: true })
  listCredentials(@CurrentUser() actor: RequestUser): Promise<WebAuthnCredential[]> {
    return this.webAuthnService.listCredentials(actor.id);
  }

  @Delete("credentials/:id")
  @ApiOperation({ summary: "Remove a registered hardware security key" })
  deleteCredential(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    return this.webAuthnService.deleteCredential(actor.id, id);
  }

  @Post("registration/challenge")
  @ApiOperation({ summary: "Get a challenge to register a new hardware security key" })
  registrationChallenge(
    @CurrentUser() actor: RequestUser,
  ): Promise<{ challenge: string; rpId: string }> {
    return this.webAuthnService.generateRegistrationChallenge(actor.id);
  }

  @Post("registration/verify")
  @ApiOperation({ summary: "Complete hardware security key registration" })
  verifyRegistration(
    @CurrentUser() actor: RequestUser,
    @CurrentOrganization() organizationId: string,
    @Body() dto: VerifyWebAuthnRegistrationDto,
  ): Promise<WebAuthnCredential> {
    return this.webAuthnService.verifyRegistration(organizationId, actor.id, dto);
  }

  @Post("assertion/challenge")
  @ApiOperation({ summary: "Get a challenge to assert an existing hardware security key" })
  assertionChallenge(
    @CurrentUser() actor: RequestUser,
  ): Promise<{ challenge: string; rpId: string }> {
    return this.webAuthnService.generateAssertionChallenge(actor.id);
  }

  @Post("assertion/verify")
  @ApiOperation({ summary: "Verify a hardware security key assertion (step-up MFA)" })
  verifyAssertion(
    @CurrentUser() actor: RequestUser,
    @CurrentOrganization() organizationId: string,
    @Body() dto: VerifyWebAuthnAssertionDto,
  ): Promise<TokenPair> {
    return this.webAuthnService.verifyAssertion(organizationId, actor.id, dto);
  }
}
