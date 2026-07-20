import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Locale } from "@prisma/client";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { LocalizationContext } from "./localization.service";
import { LocalizationService } from "./localization.service";

@ApiTags("enterprise-localization")
@ApiBearerAuth()
@Controller("enterprise/localization")
@UseGuards(TenantContextGuard)
export class LocalizationController {
  constructor(private readonly localizationService: LocalizationService) {}

  @Get("locales")
  @ApiOperation({ summary: "List locales the platform supports" })
  listSupportedLocales(): Locale[] {
    return this.localizationService.listSupportedLocales();
  }

  @Get("context")
  @ApiOperation({ summary: "Resolve the effective locale/timezone/currency for the organization" })
  resolveForOrganization(
    @CurrentOrganization() organizationId: string,
  ): Promise<LocalizationContext> {
    return this.localizationService.resolveForOrganization(organizationId);
  }

  @Get("context/branches/:branchId")
  @ApiOperation({ summary: "Resolve the effective locale/timezone/currency for a branch" })
  resolveForBranch(
    @CurrentOrganization() organizationId: string,
    @Param("branchId") branchId: string,
  ): Promise<LocalizationContext> {
    return this.localizationService.resolveForBranch(organizationId, branchId);
  }
}
