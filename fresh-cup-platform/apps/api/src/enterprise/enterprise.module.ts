import { Module } from "@nestjs/common";
import { AuthModule } from "../modules/auth/auth.module";
import { EnterpriseAuditController } from "./audit/enterprise-audit.controller";
import { EnterpriseAuditService } from "./audit/enterprise-audit.service";
import { BranchGroupsController } from "./branch-groups/branch-groups.controller";
import { BranchGroupsService } from "./branch-groups/branch-groups.service";
import { CurrencyController } from "./currency/currency.controller";
import { CurrencyService } from "./currency/currency.service";
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
import { LocalizationController } from "./localization/localization.controller";
import { LocalizationService } from "./localization/localization.service";
import { OnboardingController } from "./onboarding/onboarding.controller";
import { OnboardingService } from "./onboarding/onboarding.service";
import { OrganizationsController } from "./organizations/organizations.controller";
import { OrganizationsService } from "./organizations/organizations.service";
import { OrgRolesGuard } from "./rbac/org-roles.guard";
import { PricingController } from "./pricing/pricing.controller";
import { LocalPaymentMethodService } from "./pricing/local-payment-method.service";
import { RegionalPricingService } from "./pricing/regional-pricing.service";
import { ReceiptTemplateController } from "./receipts/receipt-template.controller";
import { ReceiptTemplateService } from "./receipts/receipt-template.service";
import { RegionsController } from "./regions/regions.controller";
import { RegionsService } from "./regions/regions.service";
import { ScimController } from "./scim/scim.controller";
import { ScimAuthGuard } from "./scim/scim-auth.guard";
import { ScimService } from "./scim/scim.service";
import { EnterpriseSessionsController } from "./sessions/enterprise-sessions.controller";
import { EnterpriseSessionsService } from "./sessions/enterprise-sessions.service";
import { SsoController } from "./sso/sso.controller";
import { SsoService } from "./sso/sso.service";
import { TaxEngineController } from "./tax/tax-engine.controller";
import { TaxEngineService } from "./tax/tax-engine.service";
import { TenancyModule } from "./tenancy/tenancy.module";
import { WebAuthnController } from "./webauthn/webauthn.controller";
import { WebAuthnService } from "./webauthn/webauthn.service";

/**
 * Phase 8 Part 1 — Enterprise Foundation (multi-tenant architecture,
 * org-level RBAC, feature flags, licensing, global config, tenant
 * onboarding), Phase 8 Part 2 — Enterprise Security (SSO/SAML, SCIM,
 * WebAuthn, IP allowlisting, device trust, org-wide session oversight,
 * a hash-chained audit trail), and Phase 8 Part 3 — Global Operations
 * (multi-currency, rule-based tax engine, locale/timezone resolution,
 * regional pricing, local payment method registry, country-specific
 * receipt templates). See docs/ROADMAP.md's Phase 8 sections for the
 * scope decisions each piece documents in its own file.
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
    CurrencyController,
    TaxEngineController,
    LocalizationController,
    PricingController,
    ReceiptTemplateController,
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
    CurrencyService,
    TaxEngineService,
    LocalizationService,
    RegionalPricingService,
    LocalPaymentMethodService,
    ReceiptTemplateService,
  ],
  exports: [
    FeatureFlagsService,
    GlobalConfigService,
    LicensingService,
    EnterpriseAuditService,
    CurrencyService,
    TaxEngineService,
    LocalizationService,
  ],
})
export class EnterpriseModule {}
