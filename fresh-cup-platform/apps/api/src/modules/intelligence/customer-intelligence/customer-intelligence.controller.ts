import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CustomerIntelligenceService } from "./customer-intelligence.service";
import { CustomerIntelligenceProfileDto } from "./dto/customer-intelligence-profile.dto";
import { CustomerSegmentsResponseDto, SegmentSummaryResponseDto } from "./dto/customer-segment.dto";
import { ListSegmentsQueryDto } from "./dto/list-segments-query.dto";

@ApiTags("customer-intelligence")
@Controller("admin/customer-intelligence")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
export class CustomerIntelligenceController {
  constructor(private readonly customerIntelligenceService: CustomerIntelligenceService) {}

  @Get("segments")
  @ApiOperation({ summary: "RFM-scored customer list with churn risk and predicted LTV" })
  @ApiOkResponse({ type: CustomerSegmentsResponseDto })
  async segments(
    @CurrentUser() actor: RequestUser,
    @Query() query: ListSegmentsQueryDto,
  ): Promise<CustomerSegmentsResponseDto> {
    const customers = await this.customerIntelligenceService.segments(actor, query);
    return { customers };
  }

  @Get("segment-summary")
  @ApiOperation({ summary: "Customer counts and spend per RFM segment" })
  @ApiOkResponse({ type: SegmentSummaryResponseDto })
  async segmentSummary(
    @CurrentUser() actor: RequestUser,
    @Query("branchId") branchId?: string,
  ): Promise<SegmentSummaryResponseDto> {
    const segments = await this.customerIntelligenceService.segmentSummary(actor, branchId);
    return { segments };
  }

  @Get("customers/:id")
  @ApiOperation({
    summary:
      "Full intelligence profile for one customer: RFM, LTV, churn, favorite categories, preferred order time/payment, coupon effectiveness, loyalty progression",
  })
  @ApiOkResponse({ type: CustomerIntelligenceProfileDto })
  async customerProfile(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
  ): Promise<CustomerIntelligenceProfileDto> {
    return this.customerIntelligenceService.customerProfile(actor, id);
  }
}
