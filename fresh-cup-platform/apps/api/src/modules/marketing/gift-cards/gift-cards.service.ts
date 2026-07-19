import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { GiftCard } from "@prisma/client";
import { generateAlphanumericCode } from "../../../common/crypto/token.util";
import { paginate } from "../../../common/pagination/paginate";
import { PrismaService } from "../../../database/prisma.service";
import type { AdjustGiftCardDto } from "./dto/adjust-gift-card.dto";
import type { CreateGiftCardDto } from "./dto/create-gift-card.dto";
import type { GiftCardResponseDto } from "./dto/gift-card-response.dto";
import type { ListGiftCardsQueryDto } from "./dto/list-gift-cards-query.dto";

@Injectable()
export class GiftCardsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListGiftCardsQueryDto) {
    return paginate<GiftCard>(
      (page) =>
        this.prisma.giftCard.findMany({
          where: { issuedToUserId: query.issuedToUserId },
          orderBy: { createdAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<GiftCard> {
    const card = await this.prisma.giftCard.findUnique({ where: { id } });
    if (!card) {
      throw new NotFoundException("Gift card not found");
    }
    return card;
  }

  async create(dto: CreateGiftCardDto): Promise<GiftCard> {
    let code = generateAlphanumericCode(10);
    while (await this.prisma.giftCard.findUnique({ where: { code } })) {
      code = generateAlphanumericCode(10);
    }
    return this.prisma.giftCard.create({
      data: {
        code,
        initialBalance: dto.initialBalance,
        currentBalance: dto.initialBalance,
        issuedToUserId: dto.issuedToUserId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  /** Every balance change is recorded in the append-only ledger, same pattern as InventoryTransaction. */
  async adjust(id: string, dto: AdjustGiftCardDto): Promise<GiftCard> {
    const card = await this.findByIdOrThrow(id);
    const resultingBalance = card.currentBalance + dto.amount;
    if (resultingBalance < 0) {
      throw new BadRequestException(
        "This adjustment would leave the gift card with a negative balance",
      );
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.giftCardTransaction.create({
        data: { giftCardId: id, amount: dto.amount, orderId: dto.orderId, note: dto.note },
      }),
      this.prisma.giftCard.update({ where: { id }, data: { currentBalance: resultingBalance } }),
    ]);
    return updated;
  }

  toResponse(card: GiftCard): GiftCardResponseDto {
    return {
      id: card.id,
      code: card.code,
      initialBalance: card.initialBalance,
      currentBalance: card.currentBalance,
      issuedToUserId: card.issuedToUserId,
      isActive: card.isActive,
      expiresAt: card.expiresAt,
      createdAt: card.createdAt,
    };
  }
}
