import { BadRequestException } from "@nestjs/common";
import type { GiftCard } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import { GiftCardsService } from "./gift-cards.service";

function makeCard(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "card-1",
    code: "ABCD1234EF",
    initialBalance: 10_000,
    currentBalance: 10_000,
    issuedToUserId: null,
    isActive: true,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GiftCard;
}

describe("GiftCardsService", () => {
  let service: GiftCardsService;
  let prisma: {
    giftCard: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    giftCardTransaction: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      giftCard: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      giftCardTransaction: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new GiftCardsService(prisma as unknown as PrismaService);
  });

  describe("create", () => {
    it("retries code generation until it finds a code that doesn't already exist", async () => {
      prisma.giftCard.findUnique
        .mockResolvedValueOnce({ id: "collision" })
        .mockResolvedValueOnce(null);
      prisma.giftCard.create.mockResolvedValue(makeCard());

      await service.create({ initialBalance: 5000 });

      expect(prisma.giftCard.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.giftCard.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ initialBalance: 5000, currentBalance: 5000 }),
      });
    });
  });

  describe("adjust", () => {
    it("applies a positive adjustment and records a ledger entry", async () => {
      const card = makeCard({ currentBalance: 1000 });
      prisma.giftCard.findUnique.mockResolvedValue(card);
      prisma.$transaction.mockResolvedValue([{}, { ...card, currentBalance: 1500 }]);

      const result = await service.adjust(card.id, { amount: 500 });

      expect(result.currentBalance).toBe(1500);
    });

    it("rejects an adjustment that would leave the balance negative", async () => {
      const card = makeCard({ currentBalance: 200 });
      prisma.giftCard.findUnique.mockResolvedValue(card);

      await expect(service.adjust(card.id, { amount: -500 })).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
