import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { InventoryItem } from "@prisma/client";
import { assertBranchAccess } from "../../common/access/branch-access.util";
import { paginate } from "../../common/pagination/paginate";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import type { AdjustStockDto } from "./dto/adjust-stock.dto";
import type { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import type { InventoryItemResponseDto } from "./dto/inventory-item-response.dto";
import type { ListInventoryItemsQueryDto } from "./dto/list-inventory-items-query.dto";
import type { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListInventoryItemsQueryDto) {
    return paginate<InventoryItem>(
      (page) =>
        this.prisma.inventoryItem.findMany({
          where: { branchId: query.branchId },
          orderBy: { name: "asc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<InventoryItem> {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Inventory item not found");
    }
    return item;
  }

  create(actor: RequestUser, dto: CreateInventoryItemDto): Promise<InventoryItem> {
    assertBranchAccess(actor, dto.branchId);
    return this.prisma.inventoryItem.create({ data: dto });
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItem> {
    const item = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, item.branchId);
    return this.prisma.inventoryItem.update({ where: { id }, data: dto });
  }

  /** Every stock change is recorded in the append-only ledger before the cached total is updated. */
  async adjustStock(actor: RequestUser, id: string, dto: AdjustStockDto): Promise<InventoryItem> {
    const item = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, item.branchId);

    const resultingStock = Number(item.currentStock) + dto.delta;
    if (resultingStock < 0) {
      throw new BadRequestException(
        `This adjustment would leave ${item.name} at a negative stock level`,
      );
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          delta: dto.delta,
          reason: dto.reason,
          note: dto.note,
          actorUserId: actor.id,
        },
      }),
      this.prisma.inventoryItem.update({
        where: { id },
        data: { currentStock: resultingStock },
      }),
    ]);

    return updated;
  }

  toResponse(item: InventoryItem): InventoryItemResponseDto {
    const currentStock = Number(item.currentStock);
    const reorderThreshold = Number(item.reorderThreshold);
    return {
      id: item.id,
      branchId: item.branchId,
      name: item.name,
      unit: item.unit,
      currentStock,
      reorderThreshold,
      unitCost: item.unitCost,
      isActive: item.isActive,
      isLowStock: currentStock <= reorderThreshold,
    };
  }
}
