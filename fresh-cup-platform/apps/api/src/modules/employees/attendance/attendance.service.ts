import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Attendance, Prisma } from "@prisma/client";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { AttendanceResponseDto } from "./dto/attendance-response.dto";
import type { ListAttendanceQueryDto } from "./dto/list-attendance-query.dto";

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async clockIn(actor: RequestUser, branchId: string): Promise<Attendance> {
    const open = await this.prisma.attendance.findFirst({
      where: { userId: actor.id, clockOutAt: null },
    });
    if (open) {
      throw new BadRequestException("Already clocked in — clock out first");
    }
    return this.prisma.attendance.create({ data: { userId: actor.id, branchId } });
  }

  async clockOut(actor: RequestUser): Promise<Attendance> {
    const open = await this.prisma.attendance.findFirst({
      where: { userId: actor.id, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
    });
    if (!open) {
      throw new NotFoundException("No open attendance record to clock out of");
    }
    return this.prisma.attendance.update({
      where: { id: open.id },
      data: { clockOutAt: new Date() },
    });
  }

  list(query: ListAttendanceQueryDto) {
    const where: Prisma.AttendanceWhereInput = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.userId) where.userId = query.userId;

    return paginate<Attendance>(
      (page) =>
        this.prisma.attendance.findMany({
          where,
          orderBy: { clockInAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  toResponse(attendance: Attendance): AttendanceResponseDto {
    return {
      id: attendance.id,
      userId: attendance.userId,
      branchId: attendance.branchId,
      clockInAt: attendance.clockInAt,
      clockOutAt: attendance.clockOutAt,
    };
  }
}
