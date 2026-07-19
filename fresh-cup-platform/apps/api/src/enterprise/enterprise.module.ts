import { Module } from "@nestjs/common";
import { BranchGroupsController } from "./branch-groups/branch-groups.controller";
import { BranchGroupsService } from "./branch-groups/branch-groups.service";
import { FeatureFlagsController } from "./feature-flags/feature-flags.controller";
import { FeatureFlagsService } from "./feature-flags/feature-flags.service";
import { FranchisesController } from "./franchises/franchises.controller";
import { FranchisesService } from "./franchises/franchises.service";
import { GlobalConfigController } from "./global-config/global-config.controller";
import { GlobalConfigService } from "./global-config/global-config.service";
import { LicensingController } from "./licensing/licensing.controller";
import { LicensingService } from "./licensing/licensing.service";
import { OnboardingController } from "./onboarding/onboarding.controller";
import { OnboardingService } from "./onboarding/onboarding.service";
import { OrganizationsController } from "./organizations/organizations.controller";
import { OrganizationsService } from "./organizations/organizations.service";
import { OrgRolesGuard } from "./rbac/org-roles.guard";
import { RegionsController } from "./regions/regions.controller";
import { RegionsService } from "./regions/regions.service";
import { TenancyModule } from "./tenancy/tenancy.module";

/**
 * Phase 8 Part 1 — Enterprise Foundation: multi-tenant architecture
 * (Organization/Region/Franchise/BranchGroup hierarchy), org-level RBAC,
 * feature flags, licensing, global config, and tenant onboarding. See
 * docs/ROADMAP.md's Phase 8 section for the additive-tenancy scope
 * decision this module implements.
 */
@Module({
  imports: [TenancyModule],
  controllers: [
    OrganizationsController,
    RegionsController,
    FranchisesController,
    BranchGroupsController,
    FeatureFlagsController,
    GlobalConfigController,
    LicensingController,
    OnboardingController,
  ],
  providers: [
    OrgRolesGuard,
    OrganizationsService,
    RegionsService,
    FranchisesService,
    BranchGroupsService,
    FeatureFlagsService,
    GlobalConfigService,
    LicensingService,
    OnboardingService,
  ],
  exports: [FeatureFlagsService, GlobalConfigService, LicensingService],
})
export class EnterpriseModule {}
