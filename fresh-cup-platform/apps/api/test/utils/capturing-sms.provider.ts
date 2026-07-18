import { Injectable } from "@nestjs/common";
import type { SmsProvider } from "../../src/modules/auth/sms/sms-provider.interface";

/** Test double: captures outbound messages instead of sending/logging them. */
@Injectable()
export class CapturingSmsProvider implements SmsProvider {
  public readonly sent: Array<{ phone: string; message: string }> = [];

  async send(phone: string, message: string): Promise<void> {
    this.sent.push({ phone, message });
  }

  lastCodeFor(phone: string): string {
    const entry = [...this.sent].reverse().find((s) => s.phone === phone);
    if (!entry) {
      throw new Error(`No SMS captured for ${phone}`);
    }
    const match = /\d{6}/.exec(entry.message);
    if (!match) {
      throw new Error(`No OTP code found in captured message: ${entry.message}`);
    }
    return match[0];
  }
}
