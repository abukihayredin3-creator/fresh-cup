export interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey extends ApiKey {
  /** Shown once, at creation — never retrievable again. */
  key: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
}

export interface TwoFactorEnrollment {
  secret: string;
  otpauthUrl: string;
}
