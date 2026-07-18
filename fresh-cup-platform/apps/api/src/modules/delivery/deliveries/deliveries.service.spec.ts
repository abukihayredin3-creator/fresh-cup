import { BadRequestException } from "@nestjs/common";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import { DeliveryStatus, UserRole, type Delivery } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import type { OrdersService } from "../../ordering/orders/orders.service";
import type { DriverWithProfile, DriversService } from "../drivers/drivers.service";
import { DeliveriesService } from "./deliveries.service";

function makeDelivery(overrides: Partial<Delivery>): Delivery {
  return {
    id: "delivery-1",
    orderId: "order-1",
    branchId: "branch-1",
    driverId: null,
    zoneId: null,
    status: DeliveryStatus.UNASSIGNED,
    distanceKm: null,
    fee: 3000,
    assignedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Delivery;
}

describe("DeliveriesService", () => {
  let service: DeliveriesService;
  let prisma: {
    delivery: { findUnique: jest.Mock; update: jest.Mock; findFirst: jest.Mock };
    deliveryTrackingPing: { create: jest.Mock };
  };
  let driversService: { findByIdOrThrow: jest.Mock; recordLocation: jest.Mock };
  let ordersService: { markOutForDelivery: jest.Mock; markDelivered: jest.Mock };
  let eventEmitter: { emitAsync: jest.Mock };

  const manager: RequestUser = { id: "manager-1", role: UserRole.MANAGER, branchId: "branch-1" };
  const driverId = "driver-1";

  beforeEach(() => {
    prisma = {
      delivery: { findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      deliveryTrackingPing: { create: jest.fn() },
    };
    driversService = { findByIdOrThrow: jest.fn(), recordLocation: jest.fn() };
    ordersService = { markOutForDelivery: jest.fn(), markDelivered: jest.fn() };
    eventEmitter = { emitAsync: jest.fn() };
    service = new DeliveriesService(
      prisma as unknown as PrismaService,
      driversService as unknown as DriversService,
      ordersService as unknown as OrdersService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe("assign", () => {
    it("assigns an active driver from the same branch", async () => {
      const delivery = makeDelivery({});
      prisma.delivery.findUnique.mockResolvedValue(delivery);
      driversService.findByIdOrThrow.mockResolvedValue({
        id: driverId,
        branchId: "branch-1",
        isActive: true,
      } as unknown as DriverWithProfile);
      prisma.delivery.update.mockResolvedValue({
        ...delivery,
        driverId,
        status: DeliveryStatus.ASSIGNED,
      });

      const result = await service.assign(manager, delivery.id, { driverId });

      expect(result.status).toBe(DeliveryStatus.ASSIGNED);
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        "delivery.assigned",
        expect.objectContaining({ driverId }),
      );
    });

    it("rejects assigning a driver from a different branch", async () => {
      const delivery = makeDelivery({});
      prisma.delivery.findUnique.mockResolvedValue(delivery);
      driversService.findByIdOrThrow.mockResolvedValue({
        id: driverId,
        branchId: "other-branch",
        isActive: true,
      } as unknown as DriverWithProfile);

      await expect(service.assign(manager, delivery.id, { driverId })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects assigning to a delivery that already has a driver", async () => {
      const delivery = makeDelivery({
        driverId: "existing-driver",
        status: DeliveryStatus.ASSIGNED,
      });
      prisma.delivery.findUnique.mockResolvedValue(delivery);

      await expect(service.assign(manager, delivery.id, { driverId })).rejects.toThrow(
        BadRequestException,
      );
      expect(driversService.findByIdOrThrow).not.toHaveBeenCalled();
    });

    it("rejects assigning an inactive driver", async () => {
      const delivery = makeDelivery({});
      prisma.delivery.findUnique.mockResolvedValue(delivery);
      driversService.findByIdOrThrow.mockResolvedValue({
        id: driverId,
        branchId: "branch-1",
        isActive: false,
      } as unknown as DriverWithProfile);

      await expect(service.assign(manager, delivery.id, { driverId })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("updateStatusAsDriver", () => {
    it("moves ASSIGNED -> PICKED_UP and syncs the order to OUT_FOR_DELIVERY", async () => {
      const delivery = makeDelivery({ driverId, status: DeliveryStatus.ASSIGNED });
      prisma.delivery.findUnique.mockResolvedValue(delivery);
      prisma.delivery.update.mockResolvedValue({ ...delivery, status: DeliveryStatus.PICKED_UP });

      const result = await service.updateStatusAsDriver(
        driverId,
        delivery.id,
        DeliveryStatus.PICKED_UP,
      );

      expect(result.status).toBe(DeliveryStatus.PICKED_UP);
      expect(ordersService.markOutForDelivery).toHaveBeenCalledWith(delivery.orderId, driverId);
      expect(ordersService.markDelivered).not.toHaveBeenCalled();
    });

    it("moves PICKED_UP -> DELIVERED and syncs the order to DELIVERED", async () => {
      const delivery = makeDelivery({ driverId, status: DeliveryStatus.PICKED_UP });
      prisma.delivery.findUnique.mockResolvedValue(delivery);
      prisma.delivery.update.mockResolvedValue({ ...delivery, status: DeliveryStatus.DELIVERED });

      const result = await service.updateStatusAsDriver(
        driverId,
        delivery.id,
        DeliveryStatus.DELIVERED,
      );

      expect(result.status).toBe(DeliveryStatus.DELIVERED);
      expect(ordersService.markDelivered).toHaveBeenCalledWith(delivery.orderId, driverId);
    });

    it("rejects skipping straight from ASSIGNED to DELIVERED", async () => {
      const delivery = makeDelivery({ driverId, status: DeliveryStatus.ASSIGNED });
      prisma.delivery.findUnique.mockResolvedValue(delivery);

      await expect(
        service.updateStatusAsDriver(driverId, delivery.id, DeliveryStatus.DELIVERED),
      ).rejects.toThrow(BadRequestException);
      expect(ordersService.markDelivered).not.toHaveBeenCalled();
    });

    it("rejects a driver acting on a delivery assigned to someone else", async () => {
      const delivery = makeDelivery({ driverId: "someone-else", status: DeliveryStatus.ASSIGNED });
      prisma.delivery.findUnique.mockResolvedValue(delivery);

      await expect(
        service.updateStatusAsDriver(driverId, delivery.id, DeliveryStatus.PICKED_UP),
      ).rejects.toThrow(BadRequestException);
    });

    it("allows FAILED from EN_ROUTE without touching order status", async () => {
      const delivery = makeDelivery({ driverId, status: DeliveryStatus.EN_ROUTE });
      prisma.delivery.findUnique.mockResolvedValue(delivery);
      prisma.delivery.update.mockResolvedValue({ ...delivery, status: DeliveryStatus.FAILED });

      const result = await service.updateStatusAsDriver(
        driverId,
        delivery.id,
        DeliveryStatus.FAILED,
      );

      expect(result.status).toBe(DeliveryStatus.FAILED);
      expect(ordersService.markOutForDelivery).not.toHaveBeenCalled();
      expect(ordersService.markDelivered).not.toHaveBeenCalled();
    });
  });

  describe("recordLocation", () => {
    it("attaches a tracking ping to the driver's active delivery", async () => {
      const delivery = makeDelivery({ driverId, status: DeliveryStatus.PICKED_UP });
      prisma.delivery.findFirst.mockResolvedValue(delivery);

      await service.recordLocation(driverId, 9.02, 38.74);

      expect(driversService.recordLocation).toHaveBeenCalledWith(driverId, 9.02, 38.74);
      expect(prisma.deliveryTrackingPing.create).toHaveBeenCalledWith({
        data: { deliveryId: delivery.id, lat: 9.02, lng: 38.74 },
      });
    });

    it("skips creating a tracking ping when the driver has no active delivery", async () => {
      prisma.delivery.findFirst.mockResolvedValue(null);

      await service.recordLocation(driverId, 9.02, 38.74);

      expect(prisma.deliveryTrackingPing.create).not.toHaveBeenCalled();
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        "delivery.location_updated",
        expect.objectContaining({ deliveryId: null }),
      );
    });
  });
});
