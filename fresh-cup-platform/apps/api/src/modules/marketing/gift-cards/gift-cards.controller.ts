import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { AdjustGiftCardDto } from "./dto/adjust-gift-card.dto";
import { CreateGiftCardDto } from "./dto/create-gift-card.dto";
import { GiftCardResponseDto } from "./dto/gift-card-response.dto";
import { ListGiftCardsQueryDto } from "./dto/list-gift-cards-query.dto";
import { GiftCardsService } from "./gift-cards.service";

@ApiTags("marketing")
@Controller("admin/gift-cards")
@Roles(UserRole.MARKETING_STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("GiftCard")
export class GiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  @Get()
  @ApiOperation({ summary: "List gift cards (marketing/manager/admin)" })
  async list(@Query() query: ListGiftCardsQueryDto) {
    const page = await this.giftCardsService.list(query);
    return { ...page, items: page.items.map((c) => this.giftCardsService.toResponse(c)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a gift card by id (marketing/manager/admin)" })
  @ApiOkResponse({ type: GiftCardResponseDto })
  async get(@Param("id") id: string): Promise<GiftCardResponseDto> {
    const card = await this.giftCardsService.findByIdOrThrow(id);
    return this.giftCardsService.toResponse(card);
  }

  @Post()
  @ApiOperation({
    summary: "Issue a new gift card with a generated code (marketing/manager/admin)",
  })
  @ApiOkResponse({ type: GiftCardResponseDto })
  async create(@Body() dto: CreateGiftCardDto): Promise<GiftCardResponseDto> {
    const created = await this.giftCardsService.create(dto);
    return this.giftCardsService.toResponse(created);
  }

  @Post(":id/adjust")
  @ApiOperation({
    summary: "Record a manual gift card balance adjustment (marketing/manager/admin)",
  })
  @ApiOkResponse({ type: GiftCardResponseDto })
  async adjust(
    @Param("id") id: string,
    @Body() dto: AdjustGiftCardDto,
  ): Promise<GiftCardResponseDto> {
    const updated = await this.giftCardsService.adjust(id, dto);
    return this.giftCardsService.toResponse(updated);
  }
}
