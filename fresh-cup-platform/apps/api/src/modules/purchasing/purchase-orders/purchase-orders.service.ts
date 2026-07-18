import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  InventoryTransactionReason,
  Prisma,
  PurchaseOrderStatus,
  UserRole,
  type PurchaseOrderLine,
} from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import type { ListPurchaseOrdersQueryDto } from "./dto/list-purchase-orders-query.dto";
import type { PurchaseOrderResponseDto } from "./dto/purchase-order-response.dto";
import type { ReceivePurchaseOrderDto } from "./dto/receive-purchase-order.dto";

const WITH_LINES = { lines: true } as const;
type PurchaseOrderDetail = Prisma.PurchaseOrderGetPayload<{ include: typeof WITH_LINES }>;

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: RequestUser, query: ListPurchaseOrdersQueryDto) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (actor.role === UserRole.MANAGER || actor.role === UserRole.STAFF) {
      where.branchId = actor.branchId ?? "__no_branch__";
    } else if (query.branchId) {
      where.branchId = query.branchId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    return paginate<PurchaseOrderDetail>(
      (page) =>
        this.prisma.purchaseOrder.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: WITH_LINES,
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<PurchaseOrderDetail> {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: WITH_LINES,
    });
    if (!order) {
      throw new NotFoundException("Purchase order not found");
    }
    return order;
  }

  async create(actor: RequestUser, dto: CreatePurchaseOrderDto): Promise<PurchaseOrderDetail> {
    assertBranchAccess(actor, dto.branchId);

    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || supplier.branchId !== dto.branchId) {
      throw new BadRequestException("Supplier not found for this branch");
    }

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: { id: { in: dto.lines.map((l) => l.inventoryItemId) } },
    });
    for (const line of dto.lines) {
      const item = inventoryItems.find((i) => i.id === line.inventoryItemId);
      if (!item || item.branchId !== dto.branchId) {
        throw new BadRequestException("All lines must reference inventory items in this branch");
      }
    }

    return this.prisma.purchaseOrder.create({
      data: {
        branchId: dto.branchId,
        supplierId: dto.supplierId,
        notes: dto.notes,
        createdByUserId: actor.id,
        lines: {
          create: dto.lines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantityOrdered: line.quantityOrdered,
            unitCost: line.unitCost,
          })),
        },
      },
      include: WITH_LINES,
    });
  }

  async submit(actor: RequestUser, id: string): Promise<PurchaseOrderDetail> {
    const order = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, order.branchId);
    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException("Only draft purchase orders can be submitted");
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SUBMITTED, submittedAt: new Date() },
      include: WITH_LINES,
    });
  }

  async cancel(actor: RequestUser, id: string): Promise<PurchaseOrderDetail> {
    const order = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, order.branchId);
    if (
      order.status === PurchaseOrderStatus.RECEIVED ||
      order.status === PurchaseOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot cancel a purchase order in ${order.status} status`);
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CANCELLED },
      include: WITH_LINES,
    });
  }

  /** Records receipt, restocks inventory, and closes the purchase order — all in one transaction. */
  async receive(
    actor: RequestUser,
    id: string,
    dto: ReceivePurchaseOrderDto,
  ): Promise<PurchaseOrderDetail> {
    const order = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, order.branchId);
    if (order.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new BadRequestException("Only submitted purchase orders can be received");
    }

    const overrides = new Map((dto.lines ?? []).map((l) => [l.lineId, l.quantityReceived]));
    const validLineIds = new Set(order.lines.map((line) => line.id));
    for (const lineId of overrides.keys()) {
      if (!validLineIds.has(lineId)) {
        throw new BadRequestException(`Line ${lineId} does not belong to this purchase order`);
      }
    }

    const receivedQuantities = new Map<string, number>();
    for (const line of order.lines) {
      const quantityReceived = overrides.get(line.id) ?? Number(line.quantityOrdered);
      receivedQuantities.set(line.id, quantityReceived);
    }

    const note = `Purchase order receipt: ${order.id}`;
    await this.prisma.$transaction([
      ...order.lines.flatMap((line: PurchaseOrderLine) => {
        const quantityReceived = receivedQuantities.get(line.id)!;
        return [
          this.prisma.purchaseOrderLine.update({
            where: { id: line.id },
            data: { quantityReceived },
          }),
          this.prisma.inventoryTransaction.create({
            data: {
              inventoryItemId: line.inventoryItemId,
              delta: quantityReceived,
              reason: InventoryTransactionReason.RESTOCK,
              note,
              actorUserId: actor.id,
            },
          }),
          this.prisma.inventoryItem.update({
            where: { id: line.inventoryItemId },
            data: { currentStock: { increment: quantityReceived } },
          }),
        ];
      }),
      this.prisma.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.RECEIVED, receivedAt: new Date() },
      }),
    ]);

    return this.findByIdOrThrow(id);
  }

  toResponse(order: PurchaseOrderDetail): PurchaseOrderResponseDto {
    return {
      id: order.id,
      branchId: order.branchId,
      supplierId: order.supplierId,
      status: order.status,
      notes: order.notes,
      createdByUserId: order.createdByUserId,
      submittedAt: order.submittedAt,
      receivedAt: order.receivedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      lines: order.lines.map((line: PurchaseOrderLine) => ({
        id: line.id,
        inventoryItemId: line.inventoryItemId,
        quantityOrdered: Number(line.quantityOrdered),
        unitCost: line.unitCost,
        quantityReceived: line.quantityReceived !== null ? Number(line.quantityReceived) : null,
      })),
    };
  }
}
