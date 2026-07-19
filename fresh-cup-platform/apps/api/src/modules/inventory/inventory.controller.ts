import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { InventoryHistoryQueryDto } from "./dto/inventory-history-query.dto";
import { InventoryItemResponseDto } from "./dto/inventory-item-response.dto";
import { InventoryTransactionResponseDto } from "./dto/inventory-transaction-response.dto";
import { ListInventoryItemsQueryDto } from "./dto/list-inventory-items-query.dto";
import { PredictedShortageDto } from "./dto/predicted-shortage-response.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { WasteReportQueryDto } from "./dto/waste-report-query.dto";
import { WasteReportResponseDto } from "./dto/waste-report-response.dto";
import { InventoryService } from "./inventory.service";

@ApiTags("inventory")
@ApiBearerAuth()
@Controller("admin/inventory")
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@Auditable("InventoryItem")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: "List inventory items (staff+)" })
  async list(@Query() query: ListInventoryItemsQueryDto) {
    const page = await this.inventoryService.list(query);
    return { ...page, items: page.items.map((i) => this.inventoryService.toResponse(i)) };
  }

  @Get("low-stock")
  @ApiOperation({ summary: "List items at or below their reorder threshold (staff+)" })
  @ApiOkResponse({ type: InventoryItemResponseDto, isArray: true })
  async lowStock(@Query() query: ListInventoryItemsQueryDto): Promise<InventoryItemResponseDto[]> {
    const items = await this.inventoryService.lowStock(query);
    return items.map((i) => this.inventoryService.toResponse(i));
  }

  @Get("waste-report")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Aggregated WASTE-reason stock loss, optionally by branch/date range (manager/admin)",
  })
  @ApiOkResponse({ type: WasteReportResponseDto })
  async wasteReport(@Query() query: WasteReportQueryDto): Promise<WasteReportResponseDto> {
    return this.inventoryService.wasteReport(query);
  }

  @Get("predicted-shortages")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Items projected to run out soon, based on trailing consumption (manager/admin)",
  })
  @ApiOkResponse({ type: PredictedShortageDto, isArray: true })
  async predictedShortages(@Query("branchId") branchId?: string): Promise<PredictedShortageDto[]> {
    return this.inventoryService.predictedShortages(branchId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an inventory item by id (staff+)" })
  @ApiOkResponse({ type: InventoryItemResponseDto })
  async get(@Param("id") id: string): Promise<InventoryItemResponseDto> {
    const item = await this.inventoryService.findByIdOrThrow(id);
    return this.inventoryService.toResponse(item);
  }

  @Get(":id/history")
  @ApiOperation({ summary: "Stock transaction ledger for an item, most recent first (staff+)" })
  @ApiOkResponse({ type: InventoryTransactionResponseDto, isArray: true })
  async history(@Param("id") id: string, @Query() query: InventoryHistoryQueryDto) {
    const page = await this.inventoryService.history(id, query);
    return {
      ...page,
      items: page.items.map((tx) => this.inventoryService.transactionToResponse(tx)),
    };
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create an inventory item (manager/admin)" })
  @ApiOkResponse({ type: InventoryItemResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateInventoryItemDto,
  ): Promise<InventoryItemResponseDto> {
    const created = await this.inventoryService.create(actor, dto);
    return this.inventoryService.toResponse(created);
  }

  @Patch(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update an inventory item (manager/admin)" })
  @ApiOkResponse({ type: InventoryItemResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemResponseDto> {
    const updated = await this.inventoryService.update(actor, id, dto);
    return this.inventoryService.toResponse(updated);
  }

  @Post(":id/adjust")
  @ApiOperation({ summary: "Record a manual stock adjustment (staff+)" })
  @ApiOkResponse({ type: InventoryItemResponseDto })
  async adjustStock(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: AdjustStockDto,
  ): Promise<InventoryItemResponseDto> {
    const updated = await this.inventoryService.adjustStock(actor, id, dto);
    return this.inventoryService.toResponse(updated);
  }
}
