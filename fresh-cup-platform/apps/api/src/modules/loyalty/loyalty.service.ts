import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { LoyaltyReason } from "@prisma/client";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { ORDER_EVENTS, type OrderPaidEvent } from "../../common/events/order-events";
import type { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { paginate } from "../../common/pagination/paginate";
import { PrismaService } from "../../database/prisma.service";
import type { LoyaltyMeResponseDto } from "./dto/loyalty-me-response.dto";

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @OnEvent(ORDER_EVENTS.PAID)
  async handleOrderPaid(event: OrderPaidEvent): Promise<void> {
    const alreadyAccrued = await this.prisma.loyaltyLedger.findFirst({
      where: { orderId: event.orderId, reason: LoyaltyReason.ORDER_EARNED },
    });
    if (alreadyAccrued) {
      return;
    }

    const unitsPerPoint = this.config.get("LOYALTY_MINOR_UNITS_PER_POINT", { infer: true });
    const points = Math.floor(event.total / unitsPerPoint);
    if (points <= 0) {
      return;
    }

    await this.accrue(event.userId, event.orderId, points);
    this.logger.log(
      `Accrued ${points} loyalty point(s) for user ${event.userId} on order ${event.orderId}`,
    );
  }

  async getMe(userId: string, query: PaginationQueryDto): Promise<LoyaltyMeResponseDto> {
    const [balance, page] = await Promise.all([
      this.getBalance(userId),
      paginate(
        (pageArgs) =>
          this.prisma.loyaltyLedger.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            ...pageArgs,
          }),
        { cursor: query.cursor, limit: query.limit },
      ),
    ]);

    return {
      balance,
      nextCursor: page.nextCursor,
      history: page.items.map((entry) => ({
        id: entry.id,
        pointsDelta: entry.pointsDelta,
        reason: entry.reason,
        balanceAfter: entry.balanceAfter,
        orderId: entry.orderId,
        createdAt: entry.createdAt,
      })),
    };
  }

  private async getBalance(userId: string): Promise<number> {
    const latest = await this.prisma.loyaltyLedger.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return latest?.balanceAfter ?? 0;
  }

  private async accrue(userId: string, orderId: string, points: number): Promise<void> {
    const balance = await this.getBalance(userId);
    await this.prisma.loyaltyLedger.create({
      data: {
        userId,
        orderId,
        pointsDelta: points,
        reason: LoyaltyReason.ORDER_EARNED,
        balanceAfter: balance + points,
      },
    });
  }
}
