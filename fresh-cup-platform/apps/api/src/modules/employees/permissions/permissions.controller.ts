import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionKey, UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { GrantPermissionDto } from "./dto/grant-permission.dto";
import { PermissionResponseDto } from "./dto/permission-response.dto";
import { PermissionsService } from "./permissions.service";

@ApiTags("employees")
@Controller("admin/users/:userId/permissions")
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("StaffPermission")
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: "List an employee's granted permissions (admin only)" })
  @ApiOkResponse({ type: PermissionResponseDto, isArray: true })
  async list(@Param("userId") userId: string): Promise<PermissionResponseDto[]> {
    const permissions = await this.permissionsService.listForUser(userId);
    return permissions.map((p) => this.permissionsService.toResponse(p));
  }

  @Post()
  @ApiOperation({ summary: "Grant a permission to an employee (admin only)" })
  @ApiOkResponse({ type: PermissionResponseDto })
  async grant(
    @CurrentUser() actor: RequestUser,
    @Param("userId") userId: string,
    @Body() dto: GrantPermissionDto,
  ): Promise<PermissionResponseDto> {
    const granted = await this.permissionsService.grant(actor, userId, dto.permission);
    return this.permissionsService.toResponse(granted);
  }

  @Delete(":permission")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke a permission from an employee (admin only)" })
  async revoke(
    @Param("userId") userId: string,
    @Param("permission") permission: PermissionKey,
  ): Promise<void> {
    await this.permissionsService.revoke(userId, permission);
  }
}
