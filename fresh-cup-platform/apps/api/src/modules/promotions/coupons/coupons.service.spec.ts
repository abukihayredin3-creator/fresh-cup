import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DiscountType, type Coupon } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import { CouponsService } from "./coupons.service";

function buildCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: "coupon-1",
    code: "WELCOME10",
    discountType: DiscountType.PERCENT,
    value: 10,
    minOrderTotal: null,
    startsAt: null,
    expiresAt: null,
    maxRedemptions: null,
    maxRedemptionsPerUser: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Coupon;
}

describe("CouponsService.validateForOrder", () => {
  let service: CouponsService;
  let prisma: {
    coupon: { findUnique: jest.Mock };
    couponRedemption: { count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      coupon: { findUnique: jest.fn() },
      couponRedemption: { count: jest.fn() },
    };
    service = new CouponsService(prisma as unknown as PrismaService);
  });

  it("computes a PERCENT discount, rounded down", async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      buildCoupon({ discountType: DiscountType.PERCENT, value: 10 }),
    );
    const result = await service.validateForOrder("user-1", "WELCOME10", 9999);
    expect(result.discountAmount).toBe(999); // floor(9999 * 0.10)
    expect(result.freeDelivery).toBe(false);
  });

  it("computes an AMOUNT discount capped at the subtotal", async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      buildCoupon({ discountType: DiscountType.AMOUNT, value: 5000 }),
    );
    const result = await service.validateForOrder("user-1", "SAVE50", 3000);
    expect(result.discountAmount).toBe(3000); // capped, not 5000
  });

  it("flags FREE_DELIVERY without discounting the subtotal", async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      buildCoupon({ discountType: DiscountType.FREE_DELIVERY }),
    );
    const result = await service.validateForOrder("user-1", "FREESHIP", 10000);
    expect(result.discountAmount).toBe(0);
    expect(result.freeDelivery).toBe(true);
  });

  it("throws for an unknown code", async () => {
    prisma.coupon.findUnique.mockResolvedValue(null);
    await expect(service.validateForOrder("user-1", "NOPE", 1000)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws for an inactive coupon", async () => {
    prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ isActive: false }));
    await expect(service.validateForOrder("user-1", "WELCOME10", 1000)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws for an expired coupon", async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      buildCoupon({ expiresAt: new Date(Date.now() - 86_400_000) }),
    );
    await expect(service.validateForOrder("user-1", "WELCOME10", 1000)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws for a coupon that hasn't started yet", async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      buildCoupon({ startsAt: new Date(Date.now() + 86_400_000) }),
    );
    await expect(service.validateForOrder("user-1", "WELCOME10", 1000)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws when the subtotal is below minOrderTotal", async () => {
    prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ minOrderTotal: 5000 }));
    await expect(service.validateForOrder("user-1", "WELCOME10", 1000)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws once the global redemption cap is reached", async () => {
    prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ maxRedemptions: 5 }));
    prisma.couponRedemption.count.mockResolvedValue(5);
    await expect(service.validateForOrder("user-1", "WELCOME10", 1000)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws once the per-user redemption cap is reached", async () => {
    prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ maxRedemptionsPerUser: 1 }));
    prisma.couponRedemption.count.mockResolvedValue(1);
    await expect(service.validateForOrder("user-1", "WELCOME10", 1000)).rejects.toThrow(
      BadRequestException,
    );
  });
});
