import { BadRequestException } from "@nestjs/common";
import {
  PurchaseOrderStatus,
  UserRole,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type PurchaseOrderPayment,
} from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import { PurchaseOrdersService } from "./purchase-orders.service";

type OrderWithLines = PurchaseOrder & {
  lines: PurchaseOrderLine[];
  payments: PurchaseOrderPayment[];
};

function makeLine(overrides: Partial<PurchaseOrderLine>): PurchaseOrderLine {
  return {
    id: "line-1",
    purchaseOrderId: "po-1",
    inventoryItemId: "item-1",
    quantityOrdered: 10 as unknown as PurchaseOrderLine["quantityOrdered"],
    unitCost: 100,
    quantityReceived: null,
    ...overrides,
  } as PurchaseOrderLine;
}

function makeOrder(overrides: Partial<OrderWithLines>): OrderWithLines {
  return {
    id: "po-1",
    branchId: "branch-1",
    supplierId: "supplier-1",
    status: PurchaseOrderStatus.SUBMITTED,
    notes: null,
    createdByUserId: "manager-1",
    submittedAt: new Date(),
    receivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [makeLine({})],
    payments: [],
    invoiceNumber: null,
    invoiceUrl: null,
    ...overrides,
  } as OrderWithLines;
}

describe("PurchaseOrdersService", () => {
  let service: PurchaseOrdersService;
  let prisma: {
    purchaseOrder: { findUnique: jest.Mock; update: jest.Mock };
    purchaseOrderLine: { update: jest.Mock };
    purchaseOrderPayment: { create: jest.Mock };
    inventoryTransaction: { create: jest.Mock };
    inventoryItem: { update: jest.Mock };
    $transaction: jest.Mock;
  };

  const manager: RequestUser = { id: "manager-1", role: UserRole.MANAGER, branchId: "branch-1" };

  beforeEach(() => {
    prisma = {
      purchaseOrder: { findUnique: jest.fn(), update: jest.fn() },
      purchaseOrderLine: { update: jest.fn() },
      purchaseOrderPayment: { create: jest.fn() },
      inventoryTransaction: { create: jest.fn() },
      inventoryItem: { update: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new PurchaseOrdersService(prisma as unknown as PrismaService);
  });

  describe("submit", () => {
    it("moves a DRAFT order to SUBMITTED", async () => {
      const order = makeOrder({ status: PurchaseOrderStatus.DRAFT });
      prisma.purchaseOrder.findUnique.mockResolvedValue(order);
      prisma.purchaseOrder.update.mockResolvedValue({
        ...order,
        status: PurchaseOrderStatus.SUBMITTED,
      });

      const result = await service.submit(manager, order.id);

      expect(result.status).toBe(PurchaseOrderStatus.SUBMITTED);
    });

    it("rejects submitting a non-draft order", async () => {
      const order = makeOrder({ status: PurchaseOrderStatus.SUBMITTED });
      prisma.purchaseOrder.findUnique.mockResolvedValue(order);

      await expect(service.submit(manager, order.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe("receive", () => {
    it("restocks each line's full ordered quantity when no overrides are given", async () => {
      const order = makeOrder({
        lines: [
          makeLine({
            id: "line-1",
            inventoryItemId: "item-1",
            quantityOrdered: 10 as unknown as PurchaseOrderLine["quantityOrdered"],
          }),
          makeLine({
            id: "line-2",
            inventoryItemId: "item-2",
            quantityOrdered: 5 as unknown as PurchaseOrderLine["quantityOrdered"],
          }),
        ],
      });
      prisma.purchaseOrder.findUnique
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce({ ...order, status: PurchaseOrderStatus.RECEIVED });

      await service.receive(manager, order.id, {});

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const operations = prisma.$transaction.mock.calls[0][0] as unknown[];
      // 2 lines * 3 ops (line update, inventory txn, stock increment) + 1 purchase order update
      expect(operations).toHaveLength(7);
    });

    it("applies a partial-receive override for a specific line", async () => {
      const order = makeOrder({
        lines: [makeLine({ id: "line-1", inventoryItemId: "item-1" })],
      });
      prisma.purchaseOrder.findUnique
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce({ ...order, status: PurchaseOrderStatus.RECEIVED });

      await service.receive(manager, order.id, {
        lines: [{ lineId: "line-1", quantityReceived: 7 }],
      });

      expect(prisma.purchaseOrderLine.update).toHaveBeenCalledWith({
        where: { id: "line-1" },
        data: { quantityReceived: 7 },
      });
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { currentStock: { increment: 7 } },
      });
    });

    it("rejects an override referencing a line id that doesn't belong to this order", async () => {
      const order = makeOrder({ lines: [makeLine({ id: "line-1" })] });
      prisma.purchaseOrder.findUnique.mockResolvedValue(order);

      await expect(
        service.receive(manager, order.id, {
          lines: [{ lineId: "not-a-real-line", quantityReceived: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects receiving an order that isn't SUBMITTED", async () => {
      const order = makeOrder({ status: PurchaseOrderStatus.DRAFT });
      prisma.purchaseOrder.findUnique.mockResolvedValue(order);

      await expect(service.receive(manager, order.id, {})).rejects.toThrow(BadRequestException);
    });
  });

  describe("cancel", () => {
    it("rejects cancelling an already-received order", async () => {
      const order = makeOrder({ status: PurchaseOrderStatus.RECEIVED });
      prisma.purchaseOrder.findUnique.mockResolvedValue(order);

      await expect(service.cancel(manager, order.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe("addPayment", () => {
    it("records a payment and returns the refreshed order", async () => {
      const order = makeOrder({});
      const refreshed = makeOrder({ payments: [{ id: "pay-1", amount: 5000 }] as never });
      prisma.purchaseOrder.findUnique.mockResolvedValueOnce(order).mockResolvedValueOnce(refreshed);

      const result = await service.addPayment(manager, order.id, { amount: 5000, method: "cash" });

      expect(prisma.purchaseOrderPayment.create).toHaveBeenCalledWith({
        data: { purchaseOrderId: order.id, amount: 5000, method: "cash", note: undefined },
      });
      expect(result.payments).toHaveLength(1);
    });
  });

  describe("attachInvoice", () => {
    it("stores the invoice number and url", async () => {
      const order = makeOrder({});
      prisma.purchaseOrder.findUnique.mockResolvedValue(order);
      prisma.purchaseOrder.update.mockResolvedValue({
        ...order,
        invoiceNumber: "INV-1",
        invoiceUrl: "https://example.com/inv-1.pdf",
      });

      const result = await service.attachInvoice(manager, order.id, {
        invoiceNumber: "INV-1",
        invoiceUrl: "https://example.com/inv-1.pdf",
      });

      expect(result.invoiceNumber).toBe("INV-1");
    });
  });

  describe("toResponse", () => {
    it("sums payments into totalPaid", () => {
      const order = makeOrder({
        payments: [
          {
            id: "p1",
            purchaseOrderId: "po-1",
            amount: 3000,
            method: "cash",
            note: null,
            paidAt: new Date(),
            createdAt: new Date(),
          },
          {
            id: "p2",
            purchaseOrderId: "po-1",
            amount: 2000,
            method: "cash",
            note: null,
            paidAt: new Date(),
            createdAt: new Date(),
          },
        ] as never,
      });

      const response = service.toResponse(order);

      expect(response.totalPaid).toBe(5000);
    });
  });
});
