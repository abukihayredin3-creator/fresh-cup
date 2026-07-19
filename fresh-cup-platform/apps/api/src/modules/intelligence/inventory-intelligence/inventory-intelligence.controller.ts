import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../../common/decorators/roles.decorator";
import { InventoryIntelligenceResponseDto } from "./dto/inventory-intelligence-item.dto";
import { InventoryIntelligenceService } from "./inventory-intelligence.service";

@ApiTags("inventory-intelligence")
@Controller("admin/inventory-intelligence")
@Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.INVENTORY_STAFF)
@ApiBearerAuth()
export class InventoryIntelligenceController {
  constructor(private readonly inventoryIntelligenceService: InventoryIntelligenceService) {}

  @Get()
  @ApiOperation({
    summary:
      "Waste probability, expiry risk, and auto-reorder suggestions on top of the Phase 3 shortage predictor",
  })
  @ApiOkResponse({ type: InventoryIntelligenceResponseDto })
  async intelligence(
    @Query("branchId") branchId?: string,
  ): Promise<InventoryIntelligenceResponseDto> {
    const items = await this.inventoryIntelligenceService.intelligence(branchId);
    return { items };
  }
}
