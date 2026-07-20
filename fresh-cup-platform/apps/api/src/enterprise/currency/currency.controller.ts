import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Currency, ExchangeRate } from "@prisma/client";
import { OrgRole, UserRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { ConversionResult } from "./currency.service";
import { CurrencyService } from "./currency.service";
import { ConvertCurrencyDto } from "./dto/convert-currency.dto";
import { SetExchangeRateDto } from "./dto/set-exchange-rate.dto";
import { UpsertCurrencyDto } from "./dto/upsert-currency.dto";

@ApiTags("enterprise-currency")
@ApiBearerAuth()
@Controller("enterprise/currency")
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get("currencies")
  @ApiOperation({ summary: "List the global currency registry" })
  @ApiOkResponse({ isArray: true })
  listCurrencies(): Promise<Currency[]> {
    return this.currencyService.listCurrencies();
  }

  @Post("currencies")
  @Roles(UserRole.ADMIN)
  @Auditable("Currency")
  @ApiOperation({ summary: "Register or update a currency (platform admin — cross-tenant)" })
  upsertCurrency(@Body() dto: UpsertCurrencyDto): Promise<Currency> {
    return this.currencyService.upsertCurrency(dto);
  }

  @Get("exchange-rates")
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @ApiOperation({ summary: "List the caller's organization's admin-maintained exchange rates" })
  @ApiOkResponse({ isArray: true })
  listExchangeRates(@CurrentOrganization() organizationId: string): Promise<ExchangeRate[]> {
    return this.currencyService.listExchangeRates(organizationId);
  }

  @Post("exchange-rates")
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @Auditable("ExchangeRate")
  @ApiOperation({ summary: "Set (or replace) an exchange rate for the caller's organization" })
  setExchangeRate(
    @CurrentOrganization() organizationId: string,
    @Body() dto: SetExchangeRateDto,
  ): Promise<ExchangeRate> {
    return this.currencyService.setExchangeRate(organizationId, dto);
  }

  @Post("convert")
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @ApiOperation({ summary: "Convert an amount using the organization's on-file exchange rates" })
  convert(
    @CurrentOrganization() organizationId: string,
    @Body() dto: ConvertCurrencyDto,
  ): Promise<ConversionResult> {
    return this.currencyService.convert(organizationId, dto);
  }
}
