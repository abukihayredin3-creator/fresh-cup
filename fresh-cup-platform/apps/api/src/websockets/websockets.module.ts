import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { EnvironmentVariables } from "../common/config/env.validation";
import { DeliveryGateway } from "./delivery.gateway";
import { OrdersGateway } from "./orders.gateway";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
      }),
    }),
  ],
  providers: [OrdersGateway, DeliveryGateway],
})
export class WebsocketsModule {}
