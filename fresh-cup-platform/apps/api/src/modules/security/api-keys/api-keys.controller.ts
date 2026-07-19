import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ApiKeysService } from "./api-keys.service";
import { ApiKeyResponseDto, CreatedApiKeyResponseDto } from "./dto/api-key-response.dto";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";

@ApiTags("security")
@Controller("admin/security/api-keys")
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("ApiKey")
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: "List API keys (admin)" })
  @ApiOkResponse({ type: ApiKeyResponseDto, isArray: true })
  async list(): Promise<ApiKeyResponseDto[]> {
    const keys = await this.apiKeysService.list();
    return keys.map((k) => this.apiKeysService.toResponse(k));
  }

  @Post()
  @ApiOperation({ summary: "Create an API key — the raw key is shown once (admin)" })
  @ApiOkResponse({ type: CreatedApiKeyResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateApiKeyDto,
  ): Promise<CreatedApiKeyResponseDto> {
    return this.apiKeysService.create(actor, dto);
  }

  @Post(":id/revoke")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke an API key (admin)" })
  async revoke(@Param("id") id: string): Promise<void> {
    await this.apiKeysService.revoke(id);
  }
}
