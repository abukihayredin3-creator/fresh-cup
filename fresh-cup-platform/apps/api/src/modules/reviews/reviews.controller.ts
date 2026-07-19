import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ListReviewsQueryDto } from "./dto/list-reviews-query.dto";
import { ReviewResponseDto } from "./dto/review-response.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("reviews")
@Controller()
@Auditable("ProductReview")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get("menu-items/:menuItemId/reviews")
  @ApiOperation({ summary: "List reviews for a menu item (public)" })
  async listForItem(@Param("menuItemId") menuItemId: string, @Query() query: ListReviewsQueryDto) {
    const page = await this.reviewsService.listForItem(menuItemId, query);
    return { ...page, items: page.items.map((r) => this.reviewsService.toResponse(r)) };
  }

  @Post("menu-items/:menuItemId/reviews")
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Leave a review for a menu item (customer)" })
  @ApiOkResponse({ type: ReviewResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Param("menuItemId") menuItemId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const created = await this.reviewsService.create(actor, menuItemId, dto);
    return this.reviewsService.toResponse(created);
  }

  @Get("admin/reviews")
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN, UserRole.MARKETING_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List all reviews, for moderation (staff+)" })
  async listAdmin(@Query() query: ListReviewsQueryDto) {
    const page = await this.reviewsService.listAdmin(query);
    return { ...page, items: page.items.map((r) => this.reviewsService.toResponse(r)) };
  }

  @Delete("admin/reviews/:id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a review (manager/admin)" })
  async remove(@Param("id") id: string): Promise<void> {
    await this.reviewsService.remove(id);
  }
}
