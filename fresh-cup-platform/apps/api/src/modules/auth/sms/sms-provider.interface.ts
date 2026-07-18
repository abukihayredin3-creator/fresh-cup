export const SMS_PROVIDER = Symbol("SMS_PROVIDER");

/**
 * Dependency-inverted so a real gateway (AfroMessage, per docs/ARCHITECTURE.md)
 * can be dropped in later without AuthService/OtpService changing at all.
 */
export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}
