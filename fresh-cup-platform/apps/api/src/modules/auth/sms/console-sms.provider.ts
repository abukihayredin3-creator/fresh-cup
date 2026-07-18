import { Injectable, Logger } from "@nestjs/common";
import type { SmsProvider } from "./sms-provider.interface";

/**
 * Stand-in until a real Ethiopian SMS gateway (AfroMessage) is wired up in
 * Phase 2 — logs instead of sending, so OTP login is fully testable today.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(phone: string, message: string): Promise<void> {
    this.logger.log(`[SMS -> ${phone}] ${message}`);
  }
}
