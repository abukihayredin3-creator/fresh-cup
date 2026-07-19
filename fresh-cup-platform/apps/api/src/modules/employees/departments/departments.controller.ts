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
import { IsOptional, IsUUID } from "class-validator";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { DepartmentResponseDto } from "./dto/department-response.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

class ListDepartmentsQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

@ApiTags("employees")
@Controller("admin/departments")
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiBearerAuth()
@Auditable("Department")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: "List departments (admin/manager)" })
  @ApiOkResponse({ type: DepartmentResponseDto, isArray: true })
  async list(@Query() query: ListDepartmentsQueryDto): Promise<DepartmentResponseDto[]> {
    const departments = await this.departmentsService.list(query.branchId);
    return departments.map((d) => this.departmentsService.toResponse(d));
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Create a department (admin only)" })
  @ApiOkResponse({ type: DepartmentResponseDto })
  async create(@Body() dto: CreateDepartmentDto): Promise<DepartmentResponseDto> {
    const department = await this.departmentsService.create(dto);
    return this.departmentsService.toResponse(department);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update a department (admin only)" })
  @ApiOkResponse({ type: DepartmentResponseDto })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    const department = await this.departmentsService.update(id, dto);
    return this.departmentsService.toResponse(department);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a department (admin only)" })
  async remove(@Param("id") id: string): Promise<void> {
    await this.departmentsService.remove(id);
  }
}
