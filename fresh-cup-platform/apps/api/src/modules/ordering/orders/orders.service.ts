import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OrderStatus, OrderType, Prisma, UserRole } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import {
  ORDER_EVENTS,
  type OrderCreatedEvent,
  type OrderStatusChangedEvent,
} from "../../../common/events/order-events";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import { MenuItemsService } from "../../catalog/menu-items/menu-items.service";
import { CouponsService } from "../../promotions/coupons/coupons.service";
import { DeliveryZonesService, type ZoneMatch } from "../../delivery/zones/delivery-zones.service";
import { CartService } from "../cart/cart.service";
import { TablesService } from "../tables/tables.service";
import type { CancelOrderDto } from "./dto/cancel-order.dto";
import type { CreateOrderDto } from "./dto/create-order.dto";
import type { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import type { KitchenQueueEntryResponseDto, OrderResponseDto } from "./dto/order-response.dto";
import type { OrderStatusHistoryResponseDto } from "./dto/order-status-history-response.dto";
import type { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import {
  assertOrderTypeAllowsStatus,
  assertValidTransition,
  canCustomerCancelFrom,
} from "./order-status.util";

const WITH_ITEMS = {
  items: { orderBy: { createdAt: Prisma.SortOrder.asc }, include: { modifiers: true } },
} as const;

type OrderDetail = Prisma.OrderGetPayload<{ include: typeof WITH_ITEMS }>;

const STATUS_TIMESTAMP_FIELD: Partial<Record<OrderStatus, keyof Prisma.OrderUpdateInput>> = {
  [OrderStatus.CONFIRMED]: "confirmedAt",
  [OrderStatus.PREPARING]: "preparingAt",
  [OrderStatus.READY]: "readyAt",
  [OrderStatus.DELIVERED]: "deliveredAt",
  [OrderStatus.CANCELLED]: "cancelledAt",
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly cartService: CartService,
    private readonly menuItemsService: MenuItemsService,
    private readonly tablesService: TablesService,
    private readonly couponsService: CouponsService,
    private readonly deliveryZonesService: DeliveryZonesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async checkout(
    actor: RequestUser,
    dto: CreateOrderDto,
    idempotencyKey: string,
  ): Promise<OrderResponseDto> {
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey },
      include: WITH_ITEMS,
    });
    if (existing) {
      if (existing.userId !== actor.id) {
        throw new ConflictException("This idempotency key was already used for a different order");
      }
      return this.toResponse(existing);
    }

    const cart = await this.cartService.getCart(actor.id, dto.branchId);
    if (cart.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    let subtotal = 0;
    const orderItemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];
    for (const item of cart.items) {
      const freshMenuItem = await this.menuItemsService.findByIdOrThrow(item.menuItemId);
      if (!freshMenuItem.isAvailable) {
        throw new BadRequestException(
          `"${freshMenuItem.nameEn}" is no longer available — please update your cart`,
        );
      }
      const selections = this.cartService.validateModifierSelection(
        freshMenuItem,
        item.modifiers.map((m) => m.modifierOptionId),
      );
      const unitPrice =
        freshMenuItem.basePrice + selections.reduce((sum, s) => sum + s.priceDelta, 0);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      orderItemsData.push({
        menuItem: { connect: { id: freshMenuItem.id } },
        nameSnapshot: freshMenuItem.nameEn,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
        notes: item.notes,
        stationId: freshMenuItem.stationId,
        prepTimeSeconds: freshMenuItem.prepTimeSeconds,
        modifiers: {
          create: selections.map((s) => ({
            modifierOption: { connect: { id: s.modifierOptionId } },
            nameSnapshot: s.nameEn,
            priceDeltaSnapshot: s.priceDelta,
          })),
        },
      });
    }

    let tableId: string | undefined;
    let addressId: string | undefined;
    let deliveryAddressText: string | null = null;
    let deliveryLat: Prisma.Decimal | null = null;
    let deliveryLng: Prisma.Decimal | null = null;
    let deliveryFee = 0;
    let zoneMatch: ZoneMatch | null = null;

    if (dto.orderType === OrderType.DINE_IN) {
      if (!dto.tableId) {
        throw new BadRequestException("tableId is required for dine-in orders");
      }
      const table = await this.tablesService.findByIdOrThrow(dto.tableId);
      if (table.branchId !== dto.branchId || !table.isActive) {
        throw new BadRequestException("Table is not available for this branch");
      }
      tableId = table.id;
    } else if (dto.orderType === OrderType.DELIVERY) {
      if (!dto.addressId) {
        throw new BadRequestException("addressId is required for delivery orders");
      }
      const address = await this.prisma.address.findUnique({ where: { id: dto.addressId } });
      if (!address || address.userId !== actor.id) {
        throw new BadRequestException("Address not found");
      }
      addressId = address.id;
      deliveryAddressText = address.freeText;
      deliveryLat = address.lat;
      deliveryLng = address.lng;
      if (address.lat !== null && address.lng !== null) {
        zoneMatch = await this.deliveryZonesService.match(
          dto.branchId,
          Number(address.lat),
          Number(address.lng),
        );
        deliveryFee = zoneMatch.fee;
      } else {
        deliveryFee = this.config.get("DELIVERY_FLAT_FEE", { infer: true });
      }
    }

    const taxRate = this.config.get("TAX_RATE_PERCENT", { infer: true });
    const taxTotal = Math.floor((subtotal * taxRate) / 100);

    const order = await this.prisma.$transaction(async (tx) => {
      let discountTotal = 0;
      let couponId: string | undefined;
      let redeemedCouponId: string | undefined;

      if (dto.couponCode) {
        const validation = await this.couponsService.validateForOrder(
          actor.id,
          dto.couponCode,
          subtotal,
          tx,
        );
        discountTotal = validation.discountAmount;
        if (validation.freeDelivery) {
          deliveryFee = 0;
        }
        couponId = validation.coupon.id;
        redeemedCouponId = validation.coupon.id;
      }

      const total = Math.max(0, subtotal - discountTotal + deliveryFee + taxTotal);

      const created = await tx.order.create({
        data: {
          branchId: dto.branchId,
          userId: actor.id,
          orderType: dto.orderType,
          tableId,
          addressId,
          deliveryAddressText,
          deliveryLat,
          deliveryLng,
          subtotal,
          discountTotal,
          deliveryFee,
          taxTotal,
          total,
          couponId,
          idempotencyKey,
          notes: dto.notes,
          items: { create: orderItemsData },
          statusHistory: {
            create: { toStatus: OrderStatus.PENDING_PAYMENT, changedByUserId: actor.id },
          },
          ...(dto.orderType === OrderType.DELIVERY
            ? {
                delivery: {
                  create: {
                    branchId: dto.branchId,
                    zoneId: zoneMatch?.zone?.id,
                    distanceKm: zoneMatch?.distanceKm,
                    fee: deliveryFee,
                  },
                },
              }
            : {}),
        },
        include: WITH_ITEMS,
      });

      if (redeemedCouponId) {
        await this.couponsService.redeem(tx, redeemedCouponId, actor.id, created.id);
      }

      await tx.cart.deleteMany({ where: { userId: actor.id, branchId: dto.branchId } });

      return created;
    });

    await this.eventEmitter.emitAsync(ORDER_EVENTS.CREATED, {
      orderId: order.id,
      branchId: order.branchId,
      userId: order.userId,
    } satisfies OrderCreatedEvent);

    return this.toResponse(order);
  }

  async getOne(actor: RequestUser, id: string): Promise<OrderResponseDto> {
    const order = await this.findDetailOrThrow(id);
    this.assertCanView(actor, order);
    return this.toResponse(order);
  }

  async getTimeline(actor: RequestUser, id: string): Promise<OrderStatusHistoryResponseDto[]> {
    const order = await this.findDetailOrThrow(id);
    this.assertCanView(actor, order);
    const history = await this.prisma.orderStatusHistory.findMany({
      where: { orderId: id },
      orderBy: { createdAt: "asc" },
    });
    return history.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedByUserId: h.changedByUserId,
      note: h.note,
      createdAt: h.createdAt,
    }));
  }

  async list(actor: RequestUser, query: ListOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = {};

    if (actor.role === UserRole.CUSTOMER) {
      where.userId = actor.id;
    } else if (actor.role === UserRole.MANAGER || actor.role === UserRole.STAFF) {
      where.branchId = actor.branchId ?? "__no_branch__";
    } else if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const page = await paginate<OrderDetail>(
      (pageArgs) =>
        this.prisma.order.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: WITH_ITEMS,
          ...pageArgs,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
    return { ...page, items: page.items.map((o) => this.toResponse(o)) };
  }

  async kitchenQueue(
    actor: RequestUser,
    branchId: string,
    stationId?: string,
  ): Promise<KitchenQueueEntryResponseDto[]> {
    assertBranchAccess(actor, branchId);
    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING] },
        ...(stationId ? { items: { some: { stationId } } } : {}),
      },
      orderBy: { placedAt: "asc" },
      include: WITH_ITEMS,
    });
    return orders.map((o) => this.toKitchenQueueEntry(o));
  }

  async updateStatus(
    actor: RequestUser,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    if (dto.status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Use POST /orders/:id/cancel to cancel an order");
    }
    const order = await this.findDetailOrThrow(orderId);
    assertBranchAccess(actor, order.branchId);
    const updated = await this.transitionStatus(order, dto.status, actor.id, dto.note);
    return this.toResponse(updated);
  }

  async cancel(
    actor: RequestUser,
    orderId: string,
    dto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.findDetailOrThrow(orderId);

    if (actor.role === UserRole.CUSTOMER) {
      if (order.userId !== actor.id) {
        throw new ForbiddenException("You do not have permission to cancel this order");
      }
      if (!canCustomerCancelFrom(order.status)) {
        throw new BadRequestException("This order can no longer be cancelled");
      }
    } else {
      assertBranchAccess(actor, order.branchId);
    }

    const updated = await this.transitionStatus(order, OrderStatus.CANCELLED, actor.id, dto.note);
    return this.toResponse(updated);
  }

  /** Minimal cross-module read for PaymentsService — avoids leaking the internal OrderDetail shape. */
  async getOrderSummary(orderId: string) {
    const order = await this.findDetailOrThrow(orderId);
    return {
      id: order.id,
      userId: order.userId,
      branchId: order.branchId,
      status: order.status,
      total: order.total,
      currency: order.currency,
    };
  }

  /** Called by PaymentsService once a payment settles — idempotent against duplicate webhook deliveries. */
  async confirmAfterPayment(orderId: string): Promise<void> {
    const order = await this.findDetailOrThrow(orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return;
    }
    await this.transitionStatus(order, OrderStatus.CONFIRMED, null, "Payment confirmed");
  }

  /** Called by DeliveriesService when a driver marks a delivery picked up. */
  async markOutForDelivery(orderId: string, driverId: string): Promise<void> {
    const order = await this.findDetailOrThrow(orderId);
    await this.transitionStatus(
      order,
      OrderStatus.OUT_FOR_DELIVERY,
      driverId,
      "Picked up by driver",
    );
  }

  /** Called by DeliveriesService when a driver marks a delivery delivered. */
  async markDelivered(orderId: string, driverId: string): Promise<void> {
    const order = await this.findDetailOrThrow(orderId);
    await this.transitionStatus(order, OrderStatus.DELIVERED, driverId, "Delivered by driver");
  }

  private async transitionStatus(
    order: OrderDetail,
    toStatus: OrderStatus,
    actorUserId: string | null,
    note?: string,
  ): Promise<OrderDetail> {
    assertValidTransition(order.status, toStatus);
    assertOrderTypeAllowsStatus(order.orderType, order.status, toStatus);

    const timestampField = STATUS_TIMESTAMP_FIELD[toStatus];

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id: order.id },
        data: {
          status: toStatus,
          ...(timestampField ? { [timestampField]: new Date() } : {}),
        },
        include: WITH_ITEMS,
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus,
          changedByUserId: actorUserId,
          note,
        },
      });
      return result;
    });

    await this.eventEmitter.emitAsync(ORDER_EVENTS.STATUS_CHANGED, {
      orderId: updated.id,
      branchId: updated.branchId,
      userId: updated.userId,
      orderType: updated.orderType,
      fromStatus: order.status,
      toStatus,
      actorUserId,
    } satisfies OrderStatusChangedEvent);

    return updated;
  }

  private async findDetailOrThrow(id: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: WITH_ITEMS });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  private assertCanView(actor: RequestUser, order: OrderDetail): void {
    if (actor.role === UserRole.CUSTOMER) {
      if (order.userId !== actor.id) {
        throw new ForbiddenException("You do not have permission to view this order");
      }
      return;
    }
    assertBranchAccess(actor, order.branchId);
  }

  private toResponse(order: OrderDetail): OrderResponseDto {
    return {
      id: order.id,
      branchId: order.branchId,
      userId: order.userId,
      orderType: order.orderType,
      tableId: order.tableId,
      addressId: order.addressId,
      deliveryAddressText: order.deliveryAddressText,
      status: order.status,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      deliveryFee: order.deliveryFee,
      taxTotal: order.taxTotal,
      total: order.total,
      currency: order.currency,
      couponId: order.couponId,
      notes: order.notes,
      placedAt: order.placedAt,
      preparingAt: order.preparingAt,
      confirmedAt: order.confirmedAt,
      readyAt: order.readyAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        nameSnapshot: item.nameSnapshot,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        notes: item.notes,
        stationId: item.stationId,
        prepTimeSeconds: item.prepTimeSeconds,
        modifiers: item.modifiers.map((m) => ({
          modifierOptionId: m.modifierOptionId,
          nameSnapshot: m.nameSnapshot,
          priceDeltaSnapshot: m.priceDeltaSnapshot,
        })),
      })),
    };
  }

  private toKitchenQueueEntry(order: OrderDetail): KitchenQueueEntryResponseDto {
    const base = this.toResponse(order);
    const elapsedSeconds = order.preparingAt
      ? Math.floor((Date.now() - order.preparingAt.getTime()) / 1000)
      : null;
    const targetSeconds = order.items.reduce((max, item) => Math.max(max, item.prepTimeSeconds), 0);
    return {
      ...base,
      elapsedSeconds,
      isLate: elapsedSeconds !== null && elapsedSeconds > targetSeconds,
    };
  }
}
