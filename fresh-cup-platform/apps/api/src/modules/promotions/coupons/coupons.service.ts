import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DiscountType, Prisma, type Coupon } from "@prisma/client";
import { paginate } from "../../../common/pagination/paginate";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateCouponDto } from "./dto/create-coupon.dto";
import type { ListCouponsQueryDto } from "./dto/list-coupons-query.dto";
import type { UpdateCouponDto } from "./dto/update-coupon.dto";

export interface CouponValidationResult {
  coupon: Coupon;
  discountAmount: number;
  freeDelivery: boolean;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListCouponsQueryDto) {
    return paginate<Coupon>(
      (page) =>
        this.prisma.coupon.findMany({
          where: query.isActive === undefined ? {} : { isActive: query.isActive },
          orderBy: { createdAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException("Coupon not found");
    }
    return coupon;
  }

  async create(dto: CreateCouponDto): Promise<Coupon> {
    try {
      return await this.prisma.coupon.create({
        data: {
          ...dto,
          code: dto.code.toUpperCase(),
          startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(`A coupon with code ${dto.code.toUpperCase()} already exists`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    await this.findByIdOrThrow(id);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  /**
   * Full validation (active window, minimum order, redemption limits) and
   * discount computation. Runs both from the standalone preview endpoint
   * and, with a transaction client, again inside checkout immediately
   * before redemption — a coupon valid when the cart was built may not be
   * by the time the order is placed.
   */
  async validateForOrder(
    userId: string,
    code: string,
    subtotal: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CouponValidationResult> {
    const client = tx ?? this.prisma;
    const coupon = await client.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon) {
      throw new NotFoundException("Coupon not found");
    }

    const now = new Date();
    if (!coupon.isActive) {
      throw new BadRequestException("This coupon is no longer active");
    }
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException("This coupon is not active yet");
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException("This coupon has expired");
    }
    if (coupon.minOrderTotal !== null && subtotal < coupon.minOrderTotal) {
      throw new BadRequestException(
        `This coupon requires a minimum order of ${coupon.minOrderTotal} (minor units)`,
      );
    }
    if (coupon.maxRedemptions !== null) {
      const totalRedemptions = await client.couponRedemption.count({
        where: { couponId: coupon.id },
      });
      if (totalRedemptions >= coupon.maxRedemptions) {
        throw new BadRequestException("This coupon has reached its redemption limit");
      }
    }
    if (coupon.maxRedemptionsPerUser !== null) {
      const userRedemptions = await client.couponRedemption.count({
        where: { couponId: coupon.id, userId },
      });
      if (userRedemptions >= coupon.maxRedemptionsPerUser) {
        throw new BadRequestException(
          "You have already used this coupon the maximum number of times",
        );
      }
    }

    return { coupon, ...this.computeDiscount(coupon, subtotal) };
  }

  async redeem(
    tx: Prisma.TransactionClient,
    couponId: string,
    userId: string,
    orderId: string,
  ): Promise<void> {
    await tx.couponRedemption.create({ data: { couponId, userId, orderId } });
  }

  private computeDiscount(
    coupon: Coupon,
    subtotal: number,
  ): { discountAmount: number; freeDelivery: boolean } {
    switch (coupon.discountType) {
      case DiscountType.PERCENT:
        return { discountAmount: Math.floor((subtotal * coupon.value) / 100), freeDelivery: false };
      case DiscountType.AMOUNT:
        return { discountAmount: Math.min(coupon.value, subtotal), freeDelivery: false };
      case DiscountType.FREE_DELIVERY:
        return { discountAmount: 0, freeDelivery: true };
    }
  }
}
