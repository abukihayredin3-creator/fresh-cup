import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CreatePerformanceNoteDto } from "./dto/create-performance-note.dto";
import { PerformanceNoteResponseDto } from "./dto/performance-note-response.dto";
import { PerformanceService } from "./performance.service";

@ApiTags("employees")
@Controller("admin/users/:userId/performance-notes")
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiBearerAuth()
@Auditable("PerformanceNote")
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get()
  @ApiOperation({ summary: "List an employee's performance notes (admin/manager)" })
  @ApiOkResponse({ type: PerformanceNoteResponseDto, isArray: true })
  async list(@Param("userId") userId: string): Promise<PerformanceNoteResponseDto[]> {
    const notes = await this.performanceService.listForUser(userId);
    return notes.map((n) => this.performanceService.toResponse(n));
  }

  @Post()
  @ApiOperation({ summary: "Add a performance note for an employee (admin/manager)" })
  @ApiOkResponse({ type: PerformanceNoteResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Param("userId") userId: string,
    @Body() dto: CreatePerformanceNoteDto,
  ): Promise<PerformanceNoteResponseDto> {
    const note = await this.performanceService.create(actor, userId, dto);
    return this.performanceService.toResponse(note);
  }
}
