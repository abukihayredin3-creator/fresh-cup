import { Module } from "@nestjs/common";
import { AuthModule } from "../modules/auth/auth.module";
import { EnterpriseAuditController } from "./audit/enterprise-audit.controller";
import { EnterpriseAuditService } from "./audit/enterprise-audit.service";
import { BranchGroupsController } from "./branch-groups/branch-groups.controller";
import { BranchGroupsService } from "./branch-groups/branch-groups.service";
import { DeviceTrustController } from "./device-trust/device-trust.controller";
import { DeviceTrustService } from "./device-trust/device-trust.service";
import { FeatureFlagsController } from "./feature-flags/feature-flags.controller";
import { FeatureFlagsService } from "./feature-flags/feature-flags.service";
import { FranchisesController } from "./franchises/franchises.controller";
import { FranchisesService } from "./franchises/franchises.service";
import { GlobalConfigController } from "./global-config/global-config.controller";
import { GlobalConfigService } from "./global-config/global-config.service";
import { IpAllowlistController } from "./ip-allowlist/ip-allowlist.controller";
import { IpAllowlistModule } from "./ip-allowlist/ip-allowlist.module";
import { LicensingController } from "./licensing/licensing.controller";
import { LicensingService } from "./licensing/licensing.service";
import { OnboardingController } from "./onboarding/onboarding.controller";
import { OnboardingService } from "./onboarding/onboarding.service";
import { OrganizationsController } from "./organizations/organizations.controller";
import { OrganizationsService } from "./organizations/organizations.service";
import { OrgRolesGuard } from "./rbac/org-roles.guard";
import { RegionsController } from "./regions/regions.controller";
import { RegionsService } from "./regions/regions.service";
import { ScimController } from "./scim/scim.controller";
import { ScimAuthGuard } from "./scim/scim-auth.guard";
import { ScimService } from "./scim/scim.service";
import { EnterpriseSessionsController } from "./sessions/enterprise-sessions.controller";
import { EnterpriseSessionsService } from "./sessions/enterprise-sessions.service";
import { SsoController } from "./sso/sso.controller";
import { SsoService } from "./sso/sso.service";
import { TenancyModule } from "./tenancy/tenancy.module";
import { WebAuthnController } from "./webauthn/webauthn.controller";
import { WebAuthnService } from "./webauthn/webauthn.service";

/**
 * Phase 8 Part 1 — Enterprise Foundation (multi-tenant architecture,
 * org-level RBAC, feature flags, licensing, global config, tenant
 * onboarding) and Phase 8 Part 2 — Enterprise Security (SSO/SAML, SCIM,
 * WebAuthn, IP allowlisting, device trust, org-wide session oversight,
 * a hash-chained audit trail). See docs/ROADMAP.md's Phase 8 sections
 * for the scope decisions each piece documents in its own file.
 */
@Module({
  imports: [TenancyModule, IpAllowlistModule, AuthModule],
  controllers: [
    OrganizationsController,
    RegionsController,
    FranchisesController,
    BranchGroupsController,
    FeatureFlagsController,
    GlobalConfigController,
    LicensingController,
    OnboardingController,
    SsoController,
    ScimController,
    WebAuthnController,
    DeviceTrustController,
    EnterpriseSessionsController,
    EnterpriseAuditController,
    IpAllowlistController,
  ],
  providers: [
    OrgRolesGuard,
    ScimAuthGuard,
    OrganizationsService,
    RegionsService,
    FranchisesService,
    BranchGroupsService,
    FeatureFlagsService,
    GlobalConfigService,
    LicensingService,
    OnboardingService,
    EnterpriseAuditService,
    SsoService,
    ScimService,
    WebAuthnService,
    DeviceTrustService,
    EnterpriseSessionsService,
  ],
  exports: [FeatureFlagsService, GlobalConfigService, LicensingService, EnterpriseAuditService],
})
export class EnterpriseModule {}
