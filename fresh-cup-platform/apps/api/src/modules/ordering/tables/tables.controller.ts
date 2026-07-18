import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CreateTableDto } from "./dto/create-table.dto";
import { ListTablesQueryDto } from "./dto/list-tables-query.dto";
import { ResolveTableResponseDto } from "./dto/resolve-table-response.dto";
import { TableResponseDto } from "./dto/table-response.dto";
import { UpdateTableDto } from "./dto/update-table.dto";
import { TablesService } from "./tables.service";

@ApiTags("ordering")
@Controller()
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Public()
  @Get("tables/:qrToken")
  @ApiOperation({ summary: "Resolve a scanned QR token to its branch + table (public)" })
  @ApiOkResponse({ type: ResolveTableResponseDto })
  resolve(@Param("qrToken") qrToken: string): Promise<ResolveTableResponseDto> {
    return this.tablesService.resolveByQrToken(qrToken);
  }

  @Get("admin/tables")
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List tables (staff+)" })
  async list(@Query() query: ListTablesQueryDto) {
    const page = await this.tablesService.list(query);
    return { ...page, items: page.items.map((t) => this.tablesService.toResponse(t)) };
  }

  @Post("admin/tables")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a table and generate its QR token (manager/admin)" })
  @ApiOkResponse({ type: TableResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateTableDto,
  ): Promise<TableResponseDto> {
    const created = await this.tablesService.create(actor, dto);
    return this.tablesService.toResponse(created);
  }

  @Patch("admin/tables/:id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a table (manager/admin)" })
  @ApiOkResponse({ type: TableResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateTableDto,
  ): Promise<TableResponseDto> {
    const updated = await this.tablesService.update(actor, id, dto);
    return this.tablesService.toResponse(updated);
  }

  @Post("admin/tables/:id/regenerate-qr")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Regenerate a table's QR token, invalidating printed codes (manager/admin)",
  })
  @ApiOkResponse({ type: TableResponseDto })
  async regenerateQr(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
  ): Promise<TableResponseDto> {
    const updated = await this.tablesService.regenerateQrToken(actor, id);
    return this.tablesService.toResponse(updated);
  }
}
