import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";
import { UsersService } from "../users/users.service";
import { AuthService, type AuthResult } from "./auth.service";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { AuthTokensResponseDto } from "./dto/responses/auth-tokens.response.dto";
import { StaffLoginDto } from "./dto/staff-login.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post("otp/request")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: "Request an OTP code via SMS for phone login" })
  async requestOtp(@Body() dto: RequestOtpDto): Promise<void> {
    await this.authService.requestOtp(dto.phone);
  }

  @Public()
  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Verify an OTP code and receive a token pair" })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<AuthTokensResponseDto> {
    const result = await this.authService.verifyOtp(dto.phone, dto.code);
    return this.toTokensResponse(result);
  }

  @Public()
  @Post("staff/login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Staff/manager/admin email+password login" })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  async staffLogin(@Body() dto: StaffLoginDto): Promise<AuthTokensResponseDto> {
    const result = await this.authService.staffLogin(dto.email, dto.password);
    return this.toTokensResponse(result);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate a refresh token for a new token pair" })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponseDto> {
    const result = await this.authService.refresh(dto.refreshToken);
    return this.toTokensResponse(result);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke a refresh token" })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  private toTokensResponse(result: AuthResult): AuthTokensResponseDto {
    const { user, ...tokens } = result;
    return { ...tokens, user: this.usersService.toResponse(user) };
  }
}
