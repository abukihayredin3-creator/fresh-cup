import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { OrganizationSubscription, SubscriptionPlan } from "@prisma/client";
import { OrgRole, UserRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrgRoles } from "../rbac/org-roles.decorator";
import { OrgRolesGuard } from "../rbac/org-roles.guard";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { CreateSubscriptionPlanDto } from "./dto/create-subscription-plan.dto";
import { SubscribeDto } from "./dto/subscribe.dto";
import type { SeatLimitCheck } from "./licensing.service";
import { LicensingService } from "./licensing.service";

@ApiTags("enterprise-licensing")
@ApiBearerAuth()
@Controller("enterprise/licensing")
@Auditable("OrganizationSubscription")
export class LicensingController {
  constructor(private readonly licensingService: LicensingService) {}

  @Get("plans")
  @ApiOperation({ summary: "List sellable subscription plans" })
  @ApiOkResponse({ isArray: true })
  listPlans(): Promise<SubscriptionPlan[]> {
    return this.licensingService.listPlans();
  }

  @Post("plans")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Register a new plan (platform admin — cross-tenant)" })
  createPlan(@Body() dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    return this.licensingService.createPlan(dto);
  }

  @Get("subscription")
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @ApiOperation({ summary: "Get the caller's organization's subscription" })
  getSubscription(
    @CurrentOrganization() organizationId: string,
  ): Promise<OrganizationSubscription | null> {
    return this.licensingService.getSubscription(organizationId);
  }

  @Post("subscription")
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @OrgRoles(OrgRole.ORG_OWNER)
  @ApiOperation({ summary: "Start or change the caller's organization's subscription" })
  subscribe(
    @CurrentOrganization() organizationId: string,
    @Body() dto: SubscribeDto,
  ): Promise<OrganizationSubscription> {
    return this.licensingService.subscribe(organizationId, dto);
  }

  @Post("subscription/cancel")
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @OrgRoles(OrgRole.ORG_OWNER)
  @ApiOperation({ summary: "Cancel the caller's organization's subscription" })
  cancel(@CurrentOrganization() organizationId: string): Promise<OrganizationSubscription> {
    return this.licensingService.cancel(organizationId);
  }

  @Get("seats")
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @ApiOperation({ summary: "Check the caller's organization's licensed seat usage" })
  checkSeatLimit(@CurrentOrganization() organizationId: string): Promise<SeatLimitCheck> {
    return this.licensingService.checkSeatLimit(organizationId);
  }

  @Get("entitlements/:featureKey")
  @UseGuards(TenantContextGuard, OrgRolesGuard)
  @ApiOperation({ summary: "Check whether the caller's plan entitles a feature key" })
  async isEntitled(
    @CurrentOrganization() organizationId: string,
    @Param("featureKey") featureKey: string,
  ): Promise<{ featureKey: string; entitled: boolean }> {
    const entitled = await this.licensingService.isEntitled(organizationId, featureKey);
    return { featureKey, entitled };
  }
}
