import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ReceiptTemplate } from "@prisma/client";
import { OrgRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { UpsertReceiptTemplateDto } from "./dto/upsert-receipt-template.dto";
import { ReceiptTemplateService } from "./receipt-template.service";

@ApiTags("enterprise-receipts")
@ApiBearerAuth()
@Controller("enterprise/receipt-templates")
@UseGuards(TenantContextGuard, OrgRolesGuard)
@Auditable("ReceiptTemplate")
export class ReceiptTemplateController {
  constructor(private readonly receiptTemplateService: ReceiptTemplateService) {}

  @Get()
  @ApiOperation({ summary: "List receipt templates for the caller's organization" })
  @ApiOkResponse({ isArray: true })
  list(@CurrentOrganization() organizationId: string): Promise<ReceiptTemplate[]> {
    return this.receiptTemplateService.list(organizationId);
  }

  @Post()
  @OrgRoles(OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN)
  @ApiOperation({ summary: "Create or update a country's receipt template" })
  upsert(
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpsertReceiptTemplateDto,
  ): Promise<ReceiptTemplate> {
    return this.receiptTemplateService.upsert(organizationId, dto);
  }

  @Get(":countryCode")
  @ApiOperation({
    summary: "Resolve the effective receipt template for a country (with default fallback)",
  })
  resolve(
    @CurrentOrganization() organizationId: string,
    @Param("countryCode") countryCode: string,
  ) {
    return this.receiptTemplateService.resolveTemplate(organizationId, countryCode);
  }
}
