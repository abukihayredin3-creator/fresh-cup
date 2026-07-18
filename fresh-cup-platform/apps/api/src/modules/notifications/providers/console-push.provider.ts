import { Injectable, Logger } from "@nestjs/common";
import type { PushProvider } from "./push-provider.interface";

/** Stand-in until Firebase Cloud Messaging is wired up — logs instead of sending. */
@Injectable()
export class ConsolePushProvider implements PushProvider {
  private readonly logger = new Logger(ConsolePushProvider.name);

  async send(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    this.logger.log(
      `[PUSH -> ${deviceToken}] ${title}: ${body} ${data ? JSON.stringify(data) : ""}`,
    );
  }
}
