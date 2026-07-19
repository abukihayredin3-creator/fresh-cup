import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  generateTotpSecret,
  totpOtpauthUrl,
  verifyTotpCode,
} from "../../../common/crypto/totp.util";
import { PrismaService } from "../../../database/prisma.service";
import type {
  TwoFactorEnrollResponseDto,
  TwoFactorStatusResponseDto,
} from "./dto/two-factor-status-response.dto";

@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  async status(userId: string): Promise<TwoFactorStatusResponseDto> {
    const user = await this.findUserOrThrow(userId);
    return { enabled: user.twoFactorEnabled };
  }

  /** Generates and stores a pending secret — twoFactorEnabled stays false until verify() confirms it. */
  async enroll(userId: string): Promise<TwoFactorEnrollResponseDto> {
    const user = await this.findUserOrThrow(userId);
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
    return { secret, otpauthUrl: totpOtpauthUrl(secret, user.email ?? user.phone ?? userId) };
  }

  async verify(userId: string, code: string): Promise<void> {
    const user = await this.findUserOrThrow(userId);
    if (!user.twoFactorSecret) {
      throw new BadRequestException("Call enroll before verifying");
    }
    if (!verifyTotpCode(user.twoFactorSecret, code)) {
      throw new BadRequestException("Invalid code");
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  }

  async disable(userId: string, code: string): Promise<void> {
    const user = await this.findUserOrThrow(userId);
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException("Two-factor authentication is not enabled");
    }
    if (!verifyTotpCode(user.twoFactorSecret, code)) {
      throw new BadRequestException("Invalid code");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }
}
