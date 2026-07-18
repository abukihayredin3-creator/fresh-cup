import { HttpException, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { sha256 } from "../../common/crypto/token.util";
import type { PrismaService } from "../../database/prisma.service";
import { OtpService } from "./otp.service";
import type { SmsProvider } from "./sms/sms-provider.interface";

describe("OtpService", () => {
  let service: OtpService;
  let prisma: { otpCode: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let sms: { send: jest.Mock };
  let config: { get: jest.Mock };

  const phone = "+251911223344";

  beforeEach(() => {
    prisma = { otpCode: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } };
    sms = { send: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = { OTP_TTL_MINUTES: 5, OTP_MAX_ATTEMPTS: 5 };
        return values[key];
      }),
    };
    service = new OtpService(
      prisma as unknown as PrismaService,
      sms as unknown as SmsProvider,
      config as unknown as ConfigService<EnvironmentVariables, true>,
    );
  });

  describe("requestOtp", () => {
    it("creates a code and sends it via the SMS provider", async () => {
      prisma.otpCode.findFirst.mockResolvedValue(null);

      await service.requestOtp(phone);

      expect(prisma.otpCode.create).toHaveBeenCalledTimes(1);
      expect(sms.send).toHaveBeenCalledTimes(1);
      expect(sms.send.mock.calls[0][0]).toBe(phone);
    });

    it("throws 429 when a code was requested too recently", async () => {
      prisma.otpCode.findFirst.mockResolvedValue({
        createdAt: new Date(),
      });

      await expect(service.requestOtp(phone)).rejects.toThrow(HttpException);
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    });

    it("allows a new request once the cooldown has passed", async () => {
      prisma.otpCode.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 61_000),
      });

      await service.requestOtp(phone);
      expect(prisma.otpCode.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("verifyOtp", () => {
    it("rejects when no OTP record exists", async () => {
      prisma.otpCode.findFirst.mockResolvedValue(null);
      await expect(service.verifyOtp(phone, "123456")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects an expired code", async () => {
      prisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: sha256("123456"),
        expiresAt: new Date(Date.now() - 1000),
        attemptCount: 0,
      });
      await expect(service.verifyOtp(phone, "123456")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects and increments attempt count on a wrong code", async () => {
      prisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: sha256("123456"),
        expiresAt: new Date(Date.now() + 60_000),
        attemptCount: 0,
      });

      await expect(service.verifyOtp(phone, "000000")).rejects.toThrow(UnauthorizedException);
      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: { attemptCount: { increment: 1 } },
      });
    });

    it("rejects once max attempts have been reached, even with the right code", async () => {
      prisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: sha256("123456"),
        expiresAt: new Date(Date.now() + 60_000),
        attemptCount: 5,
      });

      await expect(service.verifyOtp(phone, "123456")).rejects.toThrow(UnauthorizedException);
    });

    it("marks the code consumed on a correct match", async () => {
      prisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: sha256("123456"),
        expiresAt: new Date(Date.now() + 60_000),
        attemptCount: 0,
      });

      await service.verifyOtp(phone, "123456");

      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: { consumedAt: expect.any(Date) },
      });
    });
  });
});
