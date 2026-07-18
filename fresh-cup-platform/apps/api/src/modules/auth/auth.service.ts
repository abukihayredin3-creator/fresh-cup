import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { verifyPassword } from "../../common/crypto/password.util";
import { UsersService } from "../users/users.service";
import { OtpService } from "./otp.service";
import { TokenService, type TokenPair } from "./token.service";

export interface AuthResult extends TokenPair {
  user: User;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  requestOtp(phone: string): Promise<void> {
    return this.otpService.requestOtp(phone);
  }

  async verifyOtp(phone: string, code: string): Promise<AuthResult> {
    await this.otpService.verifyOtp(phone, code);
    const user = await this.usersService.findOrCreateCustomerByPhone(phone);
    const tokens = await this.tokenService.issueTokenPair(user);
    return { ...tokens, user };
  }

  async staffLogin(email: string, password: string): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.passwordHash || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordValid = await verifyPassword(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const tokens = await this.tokenService.issueTokenPair(user);
    return { ...tokens, user };
  }

  refresh(refreshToken: string): Promise<AuthResult> {
    return this.tokenService.rotateRefreshToken(refreshToken);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokenService.revokeRefreshToken(refreshToken);
  }
}
