import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { RecommendationsResponseDto } from "./dto/recommended-item.dto";
import { RecommendationsService } from "./recommendations.service";

/**
 * All public — recommendations must work for anonymous browsing, not just
 * logged-in customers (see spec). `personalized` is the one exception since
 * it's meaningless without a user to personalize for.
 */
@ApiTags("recommendations")
@Controller("recommendations")
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Public()
  @Get("frequently-bought-together/:menuItemId")
  @ApiOperation({ summary: "Items commonly ordered alongside this product" })
  @ApiOkResponse({ type: RecommendationsResponseDto })
  async frequentlyBoughtTogether(
    @Param("menuItemId") menuItemId: string,
    @Query("limit") limit?: string,
  ): Promise<RecommendationsResponseDto> {
    const items = await this.recommendationsService.frequentlyBoughtTogether(
      menuItemId,
      limit ? Number(limit) : undefined,
    );
    return { items };
  }

  @Public()
  @Get("similar/:menuItemId")
  @ApiOperation({ summary: "Products similar to this one (category + tag overlap)" })
  @ApiOkResponse({ type: RecommendationsResponseDto })
  async similar(
    @Param("menuItemId") menuItemId: string,
    @Query("limit") limit?: string,
  ): Promise<RecommendationsResponseDto> {
    const items = await this.recommendationsService.similarProducts(
      menuItemId,
      limit ? Number(limit) : undefined,
    );
    return { items };
  }

  @Public()
  @Get("upsell-cross-sell/:menuItemId")
  @ApiOperation({
    summary: "Upsell (pricier same-category) + cross-sell suggestions for a product",
  })
  @ApiOkResponse({ type: RecommendationsResponseDto })
  async upsellCrossSell(
    @Param("menuItemId") menuItemId: string,
    @Query("limit") limit?: string,
  ): Promise<RecommendationsResponseDto> {
    const items = await this.recommendationsService.upsellCrossSell(
      menuItemId,
      limit ? Number(limit) : undefined,
    );
    return { items };
  }

  @Public()
  @Get("cart")
  @ApiOperation({ summary: "'Customers also ordered' across every item currently in the cart" })
  @ApiOkResponse({ type: RecommendationsResponseDto })
  async forCart(
    @Query("menuItemIds") menuItemIds?: string,
    @Query("limit") limit?: string,
  ): Promise<RecommendationsResponseDto> {
    const ids = menuItemIds ? menuItemIds.split(",").filter(Boolean) : [];
    const items = await this.recommendationsService.forCart(ids, limit ? Number(limit) : undefined);
    return { items };
  }

  @Public()
  @Get("trending")
  @ApiOperation({ summary: "Best-selling items over the trailing 7 days" })
  @ApiOkResponse({ type: RecommendationsResponseDto })
  async trending(
    @Query("branchId") branchId?: string,
    @Query("limit") limit?: string,
  ): Promise<RecommendationsResponseDto> {
    const items = await this.recommendationsService.trending(
      branchId,
      limit ? Number(limit) : undefined,
    );
    return { items };
  }

  @Public()
  @Get("seasonal")
  @ApiOperation({ summary: "Seasonal / featured picks" })
  @ApiOkResponse({ type: RecommendationsResponseDto })
  async seasonal(
    @Query("branchId") branchId?: string,
    @Query("limit") limit?: string,
  ): Promise<RecommendationsResponseDto> {
    const items = await this.recommendationsService.seasonal(
      branchId,
      limit ? Number(limit) : undefined,
    );
    return { items };
  }

  @Get("personalized")
  @ApiOperation({
    summary: "Personalized picks for the logged-in customer (collaborative filtering + fallback)",
  })
  @ApiOkResponse({ type: RecommendationsResponseDto })
  async personalized(
    @CurrentUser() actor: RequestUser,
    @Query("branchId") branchId?: string,
    @Query("limit") limit?: string,
  ): Promise<RecommendationsResponseDto> {
    const items = await this.recommendationsService.personalized(
      actor.id,
      branchId,
      limit ? Number(limit) : undefined,
    );
    return { items };
  }
}
