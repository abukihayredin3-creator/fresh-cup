import {
  Inject,
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { generateOtpCode, sha256 } from "../../common/crypto/token.util";
import { PrismaService } from "../../database/prisma.service";
import { SMS_PROVIDER, type SmsProvider } from "./sms/sms-provider.interface";

const RESEND_COOLDOWN_SECONDS = 60;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async requestOtp(phone: string): Promise<void> {
    const mostRecent = await this.prisma.otpCode.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });

    if (mostRecent) {
      const secondsSinceLast = (Date.now() - mostRecent.createdAt.getTime()) / 1000;
      if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
        throw new HttpException(
          `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = generateOtpCode();
    const ttlMinutes = this.config.get("OTP_TTL_MINUTES", { infer: true });

    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    await this.smsProvider.send(
      phone,
      `Your Fresh Cup verification code is ${code}. It expires in ${ttlMinutes} minutes.`,
    );
  }

  async verifyOtp(phone: string, code: string): Promise<void> {
    const maxAttempts = this.config.get("OTP_MAX_ATTEMPTS", { infer: true });

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired verification code");
    }

    if (otp.attemptCount >= maxAttempts) {
      throw new UnauthorizedException("Too many incorrect attempts — request a new code");
    }

    if (otp.codeHash !== sha256(code)) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid or expired verification code");
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }
}
