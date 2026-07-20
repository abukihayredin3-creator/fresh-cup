import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { TaxRule } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { CalculateTaxDto } from "./dto/calculate-tax.dto";
import { CreateTaxRuleDto } from "./dto/create-tax-rule.dto";
import type { TaxCalculationResult } from "./tax-engine.service";
import { TaxEngineService } from "./tax-engine.service";

@ApiTags("enterprise-tax")
@ApiBearerAuth()
@Controller("enterprise/tax")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@Auditable("TaxRule")
export class TaxEngineController {
  constructor(private readonly taxEngineService: TaxEngineService) {}

  @Get("rules")
  @ApiOperation({ summary: "List tax rules for the caller's organization" })
  @ApiOkResponse({ isArray: true })
  list(@CurrentOrganization() organizationId: string): Promise<TaxRule[]> {
    return this.taxEngineService.list(organizationId);
  }

  @Post("rules")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Create a tax rule" })
  create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateTaxRuleDto,
  ): Promise<TaxRule> {
    return this.taxEngineService.create(organizationId, dto);
  }

  @Delete("rules/:id")
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Delete a tax rule" })
  delete(@CurrentOrganization() organizationId: string, @Param("id") id: string): Promise<void> {
    return this.taxEngineService.delete(organizationId, id);
  }

  @Post("calculate")
  @ApiOperation({ summary: "Calculate tax for an amount using the most specific matching rule" })
  calculate(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CalculateTaxDto,
  ): Promise<TaxCalculationResult> {
    return this.taxEngineService.calculateTax(organizationId, dto);
  }
}
