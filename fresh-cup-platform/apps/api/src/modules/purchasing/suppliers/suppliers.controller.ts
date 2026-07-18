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
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { ListSuppliersQueryDto } from "./dto/list-suppliers-query.dto";
import { SupplierResponseDto } from "./dto/supplier-response.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@ApiTags("purchasing")
@Controller("admin/suppliers")
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("Supplier")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: "List suppliers (staff+)" })
  async list(@Query() query: ListSuppliersQueryDto) {
    const page = await this.suppliersService.list(query);
    return { ...page, items: page.items.map((s) => this.suppliersService.toResponse(s)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a supplier by id (staff+)" })
  @ApiOkResponse({ type: SupplierResponseDto })
  async get(@Param("id") id: string): Promise<SupplierResponseDto> {
    const supplier = await this.suppliersService.findByIdOrThrow(id);
    return this.suppliersService.toResponse(supplier);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create a supplier (manager/admin)" })
  @ApiOkResponse({ type: SupplierResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    const created = await this.suppliersService.create(actor, dto);
    return this.suppliersService.toResponse(created);
  }

  @Patch(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update a supplier (manager/admin)" })
  @ApiOkResponse({ type: SupplierResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    const updated = await this.suppliersService.update(actor, id, dto);
    return this.suppliersService.toResponse(updated);
  }

  @Delete(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a supplier (manager/admin, soft delete)" })
  async remove(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.suppliersService.softDelete(actor, id);
  }
}
