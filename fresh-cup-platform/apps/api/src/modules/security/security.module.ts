import { Module } from "@nestjs/common";
import { ApiKeysController } from "./api-keys/api-keys.controller";
import { ApiKeysService } from "./api-keys/api-keys.service";
import { SessionsController } from "./sessions/sessions.controller";
import { SessionsService } from "./sessions/sessions.service";
import { TwoFactorController } from "./two-factor/two-factor.controller";
import { TwoFactorService } from "./two-factor/two-factor.service";

@Module({
  controllers: [SessionsController, ApiKeysController, TwoFactorController],
  providers: [SessionsService, ApiKeysService, TwoFactorService],
})
export class SecurityModule {}
