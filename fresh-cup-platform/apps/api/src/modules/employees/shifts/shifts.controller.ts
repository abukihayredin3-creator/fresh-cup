import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CreateShiftDto } from "./dto/create-shift.dto";
import { ListShiftsQueryDto } from "./dto/list-shifts-query.dto";
import { ShiftResponseDto } from "./dto/shift-response.dto";
import { UpdateShiftDto } from "./dto/update-shift.dto";
import { ShiftsService } from "./shifts.service";

@ApiTags("employees")
@Controller("admin/shifts")
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiBearerAuth()
@Auditable("Shift")
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @ApiOperation({ summary: "List shifts (admin/manager)" })
  async list(@Query() query: ListShiftsQueryDto) {
    const page = await this.shiftsService.list(query);
    return { ...page, items: page.items.map((s) => this.shiftsService.toResponse(s)) };
  }

  @Post()
  @ApiOperation({ summary: "Schedule a shift (admin/manager)" })
  @ApiOkResponse({ type: ShiftResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateShiftDto,
  ): Promise<ShiftResponseDto> {
    const shift = await this.shiftsService.create(actor, dto);
    return this.shiftsService.toResponse(shift);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a shift (admin/manager)" })
  @ApiOkResponse({ type: ShiftResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateShiftDto,
  ): Promise<ShiftResponseDto> {
    const shift = await this.shiftsService.update(actor, id, dto);
    return this.shiftsService.toResponse(shift);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Cancel a shift (admin/manager)" })
  async remove(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.shiftsService.remove(actor, id);
  }
}
