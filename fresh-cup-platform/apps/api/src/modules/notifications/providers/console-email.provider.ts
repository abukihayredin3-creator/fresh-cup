import { Injectable, Logger } from "@nestjs/common";
import type { EmailProvider } from "./email-provider.interface";

/** Stand-in until a real ESP is wired up — logs instead of sending. */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[EMAIL -> ${to}] ${subject}: ${body}`);
  }
}
