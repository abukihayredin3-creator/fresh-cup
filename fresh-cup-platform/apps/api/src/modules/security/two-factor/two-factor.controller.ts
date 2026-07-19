import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import {
  TwoFactorEnrollResponseDto,
  TwoFactorStatusResponseDto,
} from "./dto/two-factor-status-response.dto";
import { VerifyTwoFactorDto } from "./dto/verify-two-factor.dto";
import { TwoFactorService } from "./two-factor.service";

@ApiTags("security")
@ApiBearerAuth()
@Controller("security/2fa")
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Get()
  @ApiOperation({ summary: "Whether two-factor authentication is enabled for this account" })
  @ApiOkResponse({ type: TwoFactorStatusResponseDto })
  async status(@CurrentUser() actor: RequestUser): Promise<TwoFactorStatusResponseDto> {
    return this.twoFactorService.status(actor.id);
  }

  @Post("enroll")
  @ApiOperation({ summary: "Generate a TOTP secret and QR code payload for this account" })
  @ApiOkResponse({ type: TwoFactorEnrollResponseDto })
  async enroll(@CurrentUser() actor: RequestUser): Promise<TwoFactorEnrollResponseDto> {
    return this.twoFactorService.enroll(actor.id);
  }

  @Post("verify")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Confirm enrollment with a code from the authenticator app" })
  async verify(@CurrentUser() actor: RequestUser, @Body() dto: VerifyTwoFactorDto): Promise<void> {
    await this.twoFactorService.verify(actor.id, dto.code);
  }

  @Post("disable")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Disable two-factor authentication for this account" })
  async disable(@CurrentUser() actor: RequestUser, @Body() dto: VerifyTwoFactorDto): Promise<void> {
    await this.twoFactorService.disable(actor.id, dto.code);
  }
}
