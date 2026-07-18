import { BadRequestException } from "@nestjs/common";
import { OrderStatus, OrderType } from "@prisma/client";
import {
  assertOrderTypeAllowsStatus,
  assertValidTransition,
  canCustomerCancelFrom,
} from "./order-status.util";

describe("order-status.util", () => {
  describe("assertValidTransition", () => {
    it("allows the documented happy-path progression", () => {
      expect(() =>
        assertValidTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED),
      ).not.toThrow();
      expect(() =>
        assertValidTransition(OrderStatus.CONFIRMED, OrderStatus.PREPARING),
      ).not.toThrow();
      expect(() => assertValidTransition(OrderStatus.PREPARING, OrderStatus.READY)).not.toThrow();
      expect(() =>
        assertValidTransition(OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY),
      ).not.toThrow();
      expect(() =>
        assertValidTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED),
      ).not.toThrow();
      expect(() =>
        assertValidTransition(OrderStatus.DELIVERED, OrderStatus.COMPLETED),
      ).not.toThrow();
    });

    it("allows cancelling from any non-terminal state", () => {
      for (const status of [
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.OUT_FOR_DELIVERY,
      ]) {
        expect(() => assertValidTransition(status, OrderStatus.CANCELLED)).not.toThrow();
      }
    });

    it("rejects skipping a step", () => {
      expect(() =>
        assertValidTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PREPARING),
      ).toThrow(BadRequestException);
    });

    it("rejects any transition out of a terminal state", () => {
      expect(() => assertValidTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toThrow(
        BadRequestException,
      );
      expect(() => assertValidTransition(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)).toThrow(
        BadRequestException,
      );
    });
  });

  describe("assertOrderTypeAllowsStatus", () => {
    it("rejects out_for_delivery/delivered for non-delivery orders", () => {
      expect(() =>
        assertOrderTypeAllowsStatus(
          OrderType.PICKUP,
          OrderStatus.READY,
          OrderStatus.OUT_FOR_DELIVERY,
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        assertOrderTypeAllowsStatus(
          OrderType.DINE_IN,
          OrderStatus.OUT_FOR_DELIVERY,
          OrderStatus.DELIVERED,
        ),
      ).toThrow(BadRequestException);
    });

    it("allows out_for_delivery/delivered for delivery orders", () => {
      expect(() =>
        assertOrderTypeAllowsStatus(
          OrderType.DELIVERY,
          OrderStatus.READY,
          OrderStatus.OUT_FOR_DELIVERY,
        ),
      ).not.toThrow();
      expect(() =>
        assertOrderTypeAllowsStatus(
          OrderType.DELIVERY,
          OrderStatus.OUT_FOR_DELIVERY,
          OrderStatus.DELIVERED,
        ),
      ).not.toThrow();
    });

    it("rejects a delivery order going straight from ready to completed", () => {
      expect(() =>
        assertOrderTypeAllowsStatus(OrderType.DELIVERY, OrderStatus.READY, OrderStatus.COMPLETED),
      ).toThrow(BadRequestException);
    });

    it("allows a pickup/dine-in order to go straight from ready to completed", () => {
      expect(() =>
        assertOrderTypeAllowsStatus(OrderType.PICKUP, OrderStatus.READY, OrderStatus.COMPLETED),
      ).not.toThrow();
      expect(() =>
        assertOrderTypeAllowsStatus(OrderType.DINE_IN, OrderStatus.READY, OrderStatus.COMPLETED),
      ).not.toThrow();
    });
  });

  describe("canCustomerCancelFrom", () => {
    it("allows only pending_payment and confirmed", () => {
      expect(canCustomerCancelFrom(OrderStatus.PENDING_PAYMENT)).toBe(true);
      expect(canCustomerCancelFrom(OrderStatus.CONFIRMED)).toBe(true);
      expect(canCustomerCancelFrom(OrderStatus.PREPARING)).toBe(false);
      expect(canCustomerCancelFrom(OrderStatus.READY)).toBe(false);
    });
  });
});
