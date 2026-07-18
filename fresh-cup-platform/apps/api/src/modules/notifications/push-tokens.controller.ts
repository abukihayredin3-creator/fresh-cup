import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";
import { PushTokensService } from "./push-tokens.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications/push-tokens")
export class PushTokensController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Register a device push token for the current user" })
  async register(
    @CurrentUser() actor: RequestUser,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<void> {
    await this.pushTokensService.register(actor.id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unregister a device push token" })
  async unregister(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.pushTokensService.unregister(actor.id, id);
  }
}
