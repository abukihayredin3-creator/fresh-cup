import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { type Delivery, DeliveryStatus, Prisma, UserRole } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import {
  DELIVERY_EVENTS,
  type DeliveryAssignedEvent,
  type DeliveryLocationUpdatedEvent,
  type DeliveryStatusChangedEvent,
} from "../../../common/events/delivery-events";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import { OrdersService } from "../../ordering/orders/orders.service";
import { DriversService } from "../drivers/drivers.service";
import type { AssignDriverDto } from "./dto/assign-driver.dto";
import type { DeliveryResponseDto } from "./dto/delivery-response.dto";
import type { DeliveryTrackingPingResponseDto } from "./dto/delivery-tracking-ping-response.dto";
import type { ListDeliveriesQueryDto } from "./dto/list-deliveries-query.dto";

/** Driver-settable status transitions; ASSIGNED is only reachable via assign(). */
const DRIVER_TRANSITIONS: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED],
  [DeliveryStatus.PICKED_UP]: [
    DeliveryStatus.EN_ROUTE,
    DeliveryStatus.DELIVERED,
    DeliveryStatus.FAILED,
  ],
  [DeliveryStatus.EN_ROUTE]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
};

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly driversService: DriversService,
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  list(actor: RequestUser, query: ListDeliveriesQueryDto) {
    const where: Prisma.DeliveryWhereInput = {};
    if (actor.role === UserRole.MANAGER || actor.role === UserRole.STAFF) {
      where.branchId = actor.branchId ?? "__no_branch__";
    } else if (query.branchId) {
      where.branchId = query.branchId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.driverId) {
      where.driverId = query.driverId;
    }

    return paginate<Delivery>(
      (page) =>
        this.prisma.delivery.findMany({
          where,
          orderBy: { createdAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<Delivery> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id } });
    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }
    return delivery;
  }

  async getTracking(actor: RequestUser, id: string): Promise<DeliveryTrackingPingResponseDto[]> {
    const delivery = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, delivery.branchId);
    const pings = await this.prisma.deliveryTrackingPing.findMany({
      where: { deliveryId: id },
      orderBy: { recordedAt: "asc" },
    });
    return pings.map((p) => ({
      id: p.id,
      lat: Number(p.lat),
      lng: Number(p.lng),
      recordedAt: p.recordedAt,
    }));
  }

  async assign(actor: RequestUser, id: string, dto: AssignDriverDto): Promise<Delivery> {
    const delivery = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, delivery.branchId);

    if (delivery.status !== DeliveryStatus.UNASSIGNED) {
      throw new BadRequestException("This delivery already has a driver assigned");
    }

    const driver = await this.driversService.findByIdOrThrow(dto.driverId);
    if (driver.branchId !== delivery.branchId) {
      throw new BadRequestException("Driver does not belong to this delivery's branch");
    }
    if (!driver.isActive) {
      throw new BadRequestException("Driver account is not active");
    }

    const updated = await this.prisma.delivery.update({
      where: { id },
      data: { driverId: driver.id, status: DeliveryStatus.ASSIGNED, assignedAt: new Date() },
    });

    await this.eventEmitter.emitAsync(DELIVERY_EVENTS.ASSIGNED, {
      deliveryId: updated.id,
      orderId: updated.orderId,
      branchId: updated.branchId,
      driverId: driver.id,
    } satisfies DeliveryAssignedEvent);

    return updated;
  }

  /** List deliveries currently or previously assigned to the calling driver. */
  listForDriver(driverId: string, query: ListDeliveriesQueryDto) {
    return paginate<Delivery>(
      (page) =>
        this.prisma.delivery.findMany({
          where: { driverId, ...(query.status ? { status: query.status } : {}) },
          orderBy: { createdAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async updateStatusAsDriver(
    driverId: string,
    id: string,
    toStatus: DeliveryStatus,
  ): Promise<Delivery> {
    const delivery = await this.findByIdOrThrow(id);
    if (delivery.driverId !== driverId) {
      throw new BadRequestException("This delivery is not assigned to you");
    }

    const allowed = DRIVER_TRANSITIONS[delivery.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition a delivery from ${delivery.status} to ${toStatus}`,
      );
    }

    if (toStatus === DeliveryStatus.PICKED_UP) {
      await this.ordersService.markOutForDelivery(delivery.orderId, driverId);
    } else if (toStatus === DeliveryStatus.DELIVERED) {
      await this.ordersService.markDelivered(delivery.orderId, driverId);
    }

    const timestampField =
      toStatus === DeliveryStatus.PICKED_UP
        ? "pickedUpAt"
        : toStatus === DeliveryStatus.DELIVERED
          ? "deliveredAt"
          : undefined;

    const updated = await this.prisma.delivery.update({
      where: { id },
      data: { status: toStatus, ...(timestampField ? { [timestampField]: new Date() } : {}) },
    });

    await this.eventEmitter.emitAsync(DELIVERY_EVENTS.STATUS_CHANGED, {
      deliveryId: updated.id,
      orderId: updated.orderId,
      branchId: updated.branchId,
      driverId: updated.driverId,
      status: updated.status,
    } satisfies DeliveryStatusChangedEvent);

    return updated;
  }

  /** Records a GPS ping and, if the driver has an active delivery, attaches it for tracking. */
  async recordLocation(driverId: string, lat: number, lng: number): Promise<void> {
    await this.driversService.recordLocation(driverId, lat, lng);

    const activeDelivery = await this.prisma.delivery.findFirst({
      where: {
        driverId,
        status: {
          in: [DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.EN_ROUTE],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeDelivery) {
      await this.prisma.deliveryTrackingPing.create({
        data: { deliveryId: activeDelivery.id, lat, lng },
      });
    }

    await this.eventEmitter.emitAsync(DELIVERY_EVENTS.LOCATION_UPDATED, {
      deliveryId: activeDelivery?.id ?? null,
      driverId,
      lat,
      lng,
    } satisfies DeliveryLocationUpdatedEvent);
  }

  toResponse(delivery: Delivery): DeliveryResponseDto {
    return {
      id: delivery.id,
      orderId: delivery.orderId,
      branchId: delivery.branchId,
      driverId: delivery.driverId,
      zoneId: delivery.zoneId,
      status: delivery.status,
      distanceKm: delivery.distanceKm ? Number(delivery.distanceKm) : null,
      fee: delivery.fee,
      assignedAt: delivery.assignedAt,
      pickedUpAt: delivery.pickedUpAt,
      deliveredAt: delivery.deliveredAt,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    };
  }
}
