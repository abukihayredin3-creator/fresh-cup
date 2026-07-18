import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import type { RequestUser } from "../../common/types/request-user.interface";
import { LoyaltyMeResponseDto } from "./dto/loyalty-me-response.dto";
import { LoyaltyService } from "./loyalty.service";

@ApiTags("loyalty")
@ApiBearerAuth()
@Controller("loyalty")
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get("me")
  @ApiOperation({ summary: "Current user's loyalty point balance and accrual history" })
  @ApiOkResponse({ type: LoyaltyMeResponseDto })
  getMe(
    @CurrentUser() actor: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<LoyaltyMeResponseDto> {
    return this.loyaltyService.getMe(actor.id, query);
  }
}
