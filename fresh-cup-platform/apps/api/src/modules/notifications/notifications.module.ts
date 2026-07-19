import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsService } from "./notifications.service";
import { ConsoleEmailProvider } from "./providers/console-email.provider";
import { ConsolePushProvider } from "./providers/console-push.provider";
import { EMAIL_PROVIDER } from "./providers/email-provider.interface";
import { PUSH_PROVIDER } from "./providers/push-provider.interface";
import { PushTokensController } from "./push-tokens.controller";
import { PushTokensService } from "./push-tokens.service";

@Module({
  imports: [AuthModule],
  controllers: [PushTokensController],
  providers: [
    NotificationsService,
    PushTokensService,
    { provide: EMAIL_PROVIDER, useClass: ConsoleEmailProvider },
    { provide: PUSH_PROVIDER, useClass: ConsolePushProvider },
  ],
  exports: [EMAIL_PROVIDER, PUSH_PROVIDER],
})
export class NotificationsModule {}
