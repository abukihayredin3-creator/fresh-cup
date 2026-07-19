import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { SettingsResponseDto } from "./dto/settings-response.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SettingsService } from "./settings.service";

@ApiTags("settings")
@Controller("admin/settings")
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiBearerAuth()
@Auditable("RestaurantSettings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: "Get restaurant-wide settings (admin/manager)" })
  @ApiOkResponse({ type: SettingsResponseDto })
  async get(): Promise<SettingsResponseDto> {
    const settings = await this.settingsService.getOrCreate();
    return this.settingsService.toResponse(settings);
  }

  @Patch()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update restaurant-wide settings (admin only)" })
  @ApiOkResponse({ type: SettingsResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<SettingsResponseDto> {
    const settings = await this.settingsService.update(actor, dto);
    return this.settingsService.toResponse(settings);
  }
}
