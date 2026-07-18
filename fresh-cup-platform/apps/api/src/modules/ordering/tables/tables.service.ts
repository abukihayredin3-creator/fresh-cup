import { Injectable, NotFoundException } from "@nestjs/common";
import type { Table } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { generateOpaqueToken } from "../../../common/crypto/token.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateTableDto } from "./dto/create-table.dto";
import type { ListTablesQueryDto } from "./dto/list-tables-query.dto";
import type { ResolveTableResponseDto } from "./dto/resolve-table-response.dto";
import type { TableResponseDto } from "./dto/table-response.dto";
import type { UpdateTableDto } from "./dto/update-table.dto";

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListTablesQueryDto) {
    return paginate<Table>(
      (page) =>
        this.prisma.table.findMany({
          where: query.branchId ? { branchId: query.branchId } : {},
          orderBy: { label: "asc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<Table> {
    const table = await this.prisma.table.findUnique({ where: { id } });
    if (!table) {
      throw new NotFoundException("Table not found");
    }
    return table;
  }

  async resolveByQrToken(qrToken: string): Promise<ResolveTableResponseDto> {
    const table = await this.prisma.table.findUnique({
      where: { qrToken },
      include: { branch: true },
    });
    if (!table || !table.isActive || !table.branch.isActive) {
      throw new NotFoundException("Table not found");
    }
    return {
      tableId: table.id,
      tableLabel: table.label,
      branchId: table.branchId,
      branchName: table.branch.name,
    };
  }

  create(actor: RequestUser, dto: CreateTableDto): Promise<Table> {
    assertBranchAccess(actor, dto.branchId);
    return this.prisma.table.create({
      data: { ...dto, qrToken: generateOpaqueToken() },
    });
  }

  async update(actor: RequestUser, id: string, dto: UpdateTableDto): Promise<Table> {
    const table = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, table.branchId);
    return this.prisma.table.update({ where: { id }, data: dto });
  }

  /** Regenerates the QR token — invalidates any printed QR codes for this table. */
  async regenerateQrToken(actor: RequestUser, id: string): Promise<Table> {
    const table = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, table.branchId);
    return this.prisma.table.update({
      where: { id },
      data: { qrToken: generateOpaqueToken() },
    });
  }

  toResponse(table: Table): TableResponseDto {
    return {
      id: table.id,
      branchId: table.branchId,
      label: table.label,
      qrToken: table.qrToken,
      isActive: table.isActive,
    };
  }
}
