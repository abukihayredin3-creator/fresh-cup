import { Injectable, NotFoundException } from "@nestjs/common";
import { PurchaseOrderStatus, type Supplier } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateSupplierDto } from "./dto/create-supplier.dto";
import type { ListSuppliersQueryDto } from "./dto/list-suppliers-query.dto";
import type { SupplierAnalyticsResponseDto } from "./dto/supplier-analytics-response.dto";
import type { SupplierResponseDto } from "./dto/supplier-response.dto";
import type { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListSuppliersQueryDto) {
    return paginate<Supplier>(
      (page) =>
        this.prisma.supplier.findMany({
          where: query.branchId ? { branchId: query.branchId } : {},
          orderBy: { name: "asc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }
    return supplier;
  }

  create(actor: RequestUser, dto: CreateSupplierDto): Promise<Supplier> {
    assertBranchAccess(actor, dto.branchId);
    return this.prisma.supplier.create({ data: dto });
  }

  async update(actor: RequestUser, id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, supplier.branchId);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async softDelete(actor: RequestUser, id: string): Promise<void> {
    const supplier = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, supplier.branchId);
    await this.prisma.supplier.update({ where: { id }, data: { isActive: false } });
  }

  /** Order-volume, spend, and lead-time stats for one supplier, computed on demand. */
  async analytics(id: string): Promise<SupplierAnalyticsResponseDto> {
    await this.findByIdOrThrow(id);

    const orders = await this.prisma.purchaseOrder.findMany({
      where: { supplierId: id },
      include: { lines: true, payments: true },
    });

    const receivedOrders = orders.filter((o) => o.status === PurchaseOrderStatus.RECEIVED);
    const cancelledOrders = orders.filter((o) => o.status === PurchaseOrderStatus.CANCELLED);

    const totalSpend = receivedOrders.reduce(
      (sum, order) =>
        sum +
        order.lines.reduce(
          (lineSum, line) => lineSum + Number(line.quantityOrdered) * line.unitCost,
          0,
        ),
      0,
    );
    const totalPaid = orders.reduce(
      (sum, order) => sum + order.payments.reduce((pSum, p) => pSum + p.amount, 0),
      0,
    );

    const leadTimes = receivedOrders
      .filter((o) => o.submittedAt && o.receivedAt)
      .map((o) => (o.receivedAt!.getTime() - o.submittedAt!.getTime()) / (24 * 60 * 60 * 1000));
    const avgLeadTimeDays =
      leadTimes.length > 0 ? leadTimes.reduce((sum, d) => sum + d, 0) / leadTimes.length : null;

    return {
      supplierId: id,
      totalOrders: orders.length,
      receivedOrders: receivedOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalSpend,
      totalPaid,
      avgLeadTimeDays,
      fulfillmentRate: orders.length > 0 ? receivedOrders.length / orders.length : 0,
    };
  }

  toResponse(supplier: Supplier): SupplierResponseDto {
    return {
      id: supplier.id,
      branchId: supplier.branchId,
      name: supplier.name,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      isActive: supplier.isActive,
    };
  }
}
