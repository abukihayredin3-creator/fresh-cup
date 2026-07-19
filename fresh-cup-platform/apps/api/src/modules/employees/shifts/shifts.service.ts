import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Shift } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateShiftDto } from "./dto/create-shift.dto";
import type { ListShiftsQueryDto } from "./dto/list-shifts-query.dto";
import type { ShiftResponseDto } from "./dto/shift-response.dto";
import type { UpdateShiftDto } from "./dto/update-shift.dto";

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListShiftsQueryDto) {
    const where: Prisma.ShiftWhereInput = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.userId) where.userId = query.userId;
    if (query.from || query.to) {
      where.startsAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    return paginate<Shift>(
      (page) =>
        this.prisma.shift.findMany({
          where,
          orderBy: { startsAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<Shift> {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      throw new NotFoundException("Shift not found");
    }
    return shift;
  }

  create(actor: RequestUser, dto: CreateShiftDto): Promise<Shift> {
    assertBranchAccess(actor, dto.branchId);
    return this.prisma.shift.create({
      data: { ...dto, startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt) },
    });
  }

  async update(actor: RequestUser, id: string, dto: UpdateShiftDto): Promise<Shift> {
    const shift = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, shift.branchId);
    return this.prisma.shift.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  async remove(actor: RequestUser, id: string): Promise<void> {
    const shift = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, shift.branchId);
    await this.prisma.shift.delete({ where: { id } });
  }

  toResponse(shift: Shift): ShiftResponseDto {
    return {
      id: shift.id,
      userId: shift.userId,
      branchId: shift.branchId,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      status: shift.status,
      notes: shift.notes,
    };
  }
}
