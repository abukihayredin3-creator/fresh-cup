import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { LocalPaymentMethodConfig, RegionalPriceOverride } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { SetLocalPaymentMethodDto } from "./dto/set-local-payment-method.dto";
import { SetRegionalPriceDto } from "./dto/set-regional-price.dto";
import { LocalPaymentMethodService } from "./local-payment-method.service";
import { RegionalPricingService } from "./regional-pricing.service";

@ApiTags("enterprise-pricing")
@ApiBearerAuth()
@Controller("enterprise/pricing")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@Auditable("RegionalPriceOverride")
export class PricingController {
  constructor(
    private readonly regionalPricingService: RegionalPricingService,
    private readonly localPaymentMethodService: LocalPaymentMethodService,
  ) {}

  @Get("regions/:regionId/overrides")
  @ApiOperation({ summary: "List regional price overrides for a region" })
  @ApiOkResponse({ isArray: true })
  listOverrides(
    @CurrentOrganization() organizationId: string,
    @Param("regionId") regionId: string,
  ): Promise<RegionalPriceOverride[]> {
    return this.regionalPricingService.list(organizationId, regionId);
  }

  @Post("regions/:regionId/overrides")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN, OrgRole.REGION_MANAGER)
  @ApiOperation({ summary: "Set (or replace) a menu item's price override for this region" })
  setOverride(
    @CurrentOrganization() organizationId: string,
    @Param("regionId") regionId: string,
    @Body() dto: SetRegionalPriceDto,
  ): Promise<RegionalPriceOverride> {
    return this.regionalPricingService.setOverride(organizationId, regionId, dto);
  }

  @Delete("regions/:regionId/overrides/:menuItemId")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN, OrgRole.REGION_MANAGER)
  @ApiOperation({ summary: "Remove a regional price override" })
  removeOverride(
    @CurrentOrganization() organizationId: string,
    @Param("regionId") regionId: string,
    @Param("menuItemId") menuItemId: string,
  ): Promise<void> {
    return this.regionalPricingService.removeOverride(organizationId, regionId, menuItemId);
  }

  @Get("menu-items/:menuItemId/effective-price")
  @ApiOperation({ summary: "Resolve a menu item's effective price for an optional region" })
  async resolveEffectivePrice(
    @Param("menuItemId") menuItemId: string,
    @Query("regionId") regionId?: string,
  ): Promise<{ priceMinor: number }> {
    const priceMinor = await this.regionalPricingService.resolveEffectivePrice(
      menuItemId,
      regionId ?? null,
    );
    return { priceMinor };
  }

  @Get("payment-methods")
  @ApiOperation({ summary: "List all configured local payment methods for the organization" })
  @ApiOkResponse({ isArray: true })
  listAllPaymentMethods(
    @CurrentOrganization() organizationId: string,
  ): Promise<LocalPaymentMethodConfig[]> {
    return this.localPaymentMethodService.listAll(organizationId);
  }

  @Get("payment-methods/:countryCode")
  @ApiOperation({ summary: "List enabled local payment methods for a country" })
  @ApiOkResponse({ isArray: true })
  listPaymentMethodsForCountry(
    @CurrentOrganization() organizationId: string,
    @Param("countryCode") countryCode: string,
  ): Promise<LocalPaymentMethodConfig[]> {
    return this.localPaymentMethodService.listForCountry(organizationId, countryCode);
  }

  @Post("payment-methods")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Enable/disable a payment method for a country" })
  setPaymentMethod(
    @CurrentOrganization() organizationId: string,
    @Body() dto: SetLocalPaymentMethodDto,
  ): Promise<LocalPaymentMethodConfig> {
    return this.localPaymentMethodService.setConfig(organizationId, dto);
  }
}
