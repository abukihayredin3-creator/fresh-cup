import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { BranchesService } from "./branches.service";
import { BranchResponseDto } from "./dto/branch-response.dto";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@ApiTags("branches")
@Controller("branches")
@Auditable("Branch")
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "List active branches" })
  @ApiOkResponse({ type: BranchResponseDto, isArray: true })
  async list(): Promise<BranchResponseDto[]> {
    const branches = await this.branchesService.listActive();
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

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a branch (admin only)" })
  @ApiOkResponse({ type: BranchResponseDto })
  async create(@Body() dto: CreateBranchDto): Promise<BranchResponseDto> {
    const branch = await this.branchesService.create(dto);
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
