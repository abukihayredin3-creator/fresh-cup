import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { SessionResponseDto } from "./dto/session-response.dto";
import { SessionsService } from "./sessions.service";

@ApiTags("security")
@ApiBearerAuth()
@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get("security/sessions")
  @ApiOperation({ summary: "List this account's active sessions (any authenticated user)" })
  @ApiOkResponse({ type: SessionResponseDto, isArray: true })
  async listMine(@CurrentUser() actor: RequestUser): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionsService.listActive(actor.id);
    return sessions.map((s) => this.sessionsService.toResponse(s));
  }

  @Delete("security/sessions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke one of this account's sessions (any authenticated user)" })
  async revokeMine(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.sessionsService.revoke(actor.id, id);
  }

  @Get("admin/security/users/:userId/sessions")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "List a user's active sessions (admin)" })
  @ApiOkResponse({ type: SessionResponseDto, isArray: true })
  async listForUser(@Param("userId") userId: string): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionsService.listActive(userId);
    return sessions.map((s) => this.sessionsService.toResponse(s));
  }

  @Post("admin/security/users/:userId/sessions/revoke-all")
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke all of a user's active sessions (admin)" })
  async revokeAllForUser(@Param("userId") userId: string): Promise<void> {
    await this.sessionsService.revokeAll(userId);
  }
}
