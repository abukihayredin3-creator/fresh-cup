import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OtpService } from "./otp.service";
import { ConsoleSmsProvider } from "./sms/console-sms.provider";
import { SMS_PROVIDER } from "./sms/sms-provider.interface";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { TokenService } from "./token.service";

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
        signOptions: { expiresIn: config.get("JWT_ACCESS_TTL", { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    JwtStrategy,
    { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider },
  ],
  exports: [TokenService, SMS_PROVIDER],
})
export class AuthModule {}
