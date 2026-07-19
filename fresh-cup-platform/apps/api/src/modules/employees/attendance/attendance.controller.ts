import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { STAFF_ROLES } from "../../../common/constants/staff-roles";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { AttendanceService } from "./attendance.service";
import { AttendanceResponseDto } from "./dto/attendance-response.dto";
import { ClockInDto } from "./dto/clock-in.dto";
import { ListAttendanceQueryDto } from "./dto/list-attendance-query.dto";

@ApiTags("employees")
@Controller("admin/attendance")
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post("clock-in")
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: "Clock in at a branch (any staff role)" })
  @ApiOkResponse({ type: AttendanceResponseDto })
  async clockIn(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ClockInDto,
  ): Promise<AttendanceResponseDto> {
    const attendance = await this.attendanceService.clockIn(actor, dto.branchId);
    return this.attendanceService.toResponse(attendance);
  }

  @Post("clock-out")
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: "Clock out of the current open shift (any staff role)" })
  @ApiOkResponse({ type: AttendanceResponseDto })
  async clockOut(@CurrentUser() actor: RequestUser): Promise<AttendanceResponseDto> {
    const attendance = await this.attendanceService.clockOut(actor);
    return this.attendanceService.toResponse(attendance);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "List attendance records (admin/manager)" })
  async list(@Query() query: ListAttendanceQueryDto) {
    const page = await this.attendanceService.list(query);
    return { ...page, items: page.items.map((a) => this.attendanceService.toResponse(a)) };
  }
}
