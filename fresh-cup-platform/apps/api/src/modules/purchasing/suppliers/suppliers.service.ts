import { Injectable, NotFoundException } from "@nestjs/common";
import type { Supplier } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateSupplierDto } from "./dto/create-supplier.dto";
import type { ListSuppliersQueryDto } from "./dto/list-suppliers-query.dto";
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
