import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { TenantContextService } from "../../enterprise/tenancy/tenant-context.service";
import { BranchesService } from "./branches.service";
import { BranchHoursResponseDto, SetBranchHoursDto } from "./dto/branch-hours.dto";
import { BranchResponseDto } from "./dto/branch-response.dto";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@ApiTags("branches")
@Controller("branches")
@Auditable("Branch")
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "List active branches" })
  @ApiOkResponse({ type: BranchResponseDto, isArray: true })
  async list(): Promise<BranchResponseDto[]> {
    const branches = await this.branchesService.listActive();
    return branches.map((b) => this.branchesService.toResponse(b));
  }

  @Get("admin/all")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List every branch, including inactive (admin/manager)" })
  @ApiOkResponse({ type: BranchResponseDto, isArray: true })
  async listAll(): Promise<BranchResponseDto[]> {
    const branches = await this.branchesService.listAll();
    return branches.map((b) => this.branchesService.toResponse(b));
  }

  @Public()
  @Get(":id")
  @ApiOperation({ summary: "Get a branch by id" })
  @ApiOkResponse({ type: BranchResponseDto })
  async get(@Param("id") id: string): Promise<BranchResponseDto> {
    const branch = await this.branchesService.findByIdOrThrow(id);
    return this.branchesService.toResponse(branch);
  }

  @Public()
  @Get(":id/hours")
  @ApiOperation({ summary: "Get a branch's weekly opening hours" })
  @ApiOkResponse({ type: BranchHoursResponseDto, isArray: true })
  async getHours(@Param("id") id: string): Promise<BranchHoursResponseDto[]> {
    const hours = await this.branchesService.getHours(id);
    return hours.map((h) => this.branchesService.hoursToResponse(h));
  }

  @Put(":id/hours")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Replace a branch's weekly opening hours (admin/manager)" })
  @ApiOkResponse({ type: BranchHoursResponseDto, isArray: true })
  async setHours(
    @Param("id") id: string,
    @Body() dto: SetBranchHoursDto,
  ): Promise<BranchHoursResponseDto[]> {
    const hours = await this.branchesService.setHours(id, dto);
    return hours.map((h) => this.branchesService.hoursToResponse(h));
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a branch (admin only) — joins the caller's organization" })
  @ApiOkResponse({ type: BranchResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateBranchDto,
  ): Promise<BranchResponseDto> {
    const organizationId = await this.tenantContext.resolveOrganizationId(actor);
    const branch = await this.branchesService.create(dto, organizationId);
    return this.branchesService.toResponse(branch);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a branch (admin only)" })
  @ApiOkResponse({ type: BranchResponseDto })
  async update(@Param("id") id: string, @Body() dto: UpdateBranchDto): Promise<BranchResponseDto> {
    const branch = await this.branchesService.update(id, dto);
    return this.branchesService.toResponse(branch);
  }
}
