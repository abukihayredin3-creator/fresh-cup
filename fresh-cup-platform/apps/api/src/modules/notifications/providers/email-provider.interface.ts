export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

/** Dependency-inverted so a real ESP (e.g. SendGrid/SES) can be dropped in without callers changing. */
export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<void>;
}
