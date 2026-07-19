import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CreateReferralCodeDto } from "./dto/create-referral-code.dto";
import { ListReferralCodesQueryDto } from "./dto/list-referral-codes-query.dto";
import { ReferralCodeResponseDto } from "./dto/referral-code-response.dto";
import { ReferralRedemptionResponseDto } from "./dto/referral-redemption-response.dto";
import { UpdateReferralCodeDto } from "./dto/update-referral-code.dto";
import { ReferralsService } from "./referrals.service";

@ApiTags("marketing")
@Controller("admin/referral-codes")
@Roles(UserRole.MARKETING_STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("ReferralCode")
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get()
  @ApiOperation({ summary: "List referral codes (marketing/manager/admin)" })
  async list(@Query() query: ListReferralCodesQueryDto) {
    const page = await this.referralsService.list(query);
    return { ...page, items: page.items.map((c) => this.referralsService.toResponse(c)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a referral code by id (marketing/manager/admin)" })
  @ApiOkResponse({ type: ReferralCodeResponseDto })
  async get(@Param("id") id: string): Promise<ReferralCodeResponseDto> {
    const code = await this.referralsService.findByIdOrThrow(id);
    return this.referralsService.toResponse(code);
  }

  @Get(":id/redemptions")
  @ApiOperation({ summary: "List redemptions of a referral code (marketing/manager/admin)" })
  @ApiOkResponse({ type: ReferralRedemptionResponseDto, isArray: true })
  async redemptions(@Param("id") id: string): Promise<ReferralRedemptionResponseDto[]> {
    const redemptions = await this.referralsService.redemptions(id);
    return redemptions.map((r) => this.referralsService.redemptionToResponse(r));
  }

  @Post()
  @ApiOperation({ summary: "Issue a referral code for a user (marketing/manager/admin)" })
  @ApiOkResponse({ type: ReferralCodeResponseDto })
  async create(@Body() dto: CreateReferralCodeDto): Promise<ReferralCodeResponseDto> {
    const created = await this.referralsService.create(dto);
    return this.referralsService.toResponse(created);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update a referral code's reward or active state (marketing/manager/admin)",
  })
  @ApiOkResponse({ type: ReferralCodeResponseDto })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateReferralCodeDto,
  ): Promise<ReferralCodeResponseDto> {
    const updated = await this.referralsService.update(id, dto);
    return this.referralsService.toResponse(updated);
  }
}
