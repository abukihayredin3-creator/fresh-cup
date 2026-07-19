import type {
  ApiKey,
  CreatedApiKey,
  Session,
  TwoFactorEnrollment,
  TwoFactorStatus,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";

export class SecurityResource {
  constructor(private readonly client: ApiClient) {}

  // Self-service sessions (any authenticated user)
  listMySessions(): Promise<Session[]> {
    return this.client.request("/security/sessions");
  }

  revokeMySession(id: string): Promise<void> {
    return this.client.request(`/security/sessions/${id}`, { method: "DELETE" });
  }

  // Admin: another user's sessions
  listUserSessions(userId: string): Promise<Session[]> {
    return this.client.request(`/admin/security/users/${userId}/sessions`);
  }

  revokeAllUserSessions(userId: string): Promise<void> {
    return this.client.request(`/admin/security/users/${userId}/sessions/revoke-all`, {
      method: "POST",
    });
  }

  // API keys (admin)
  listApiKeys(): Promise<ApiKey[]> {
    return this.client.request("/admin/security/api-keys");
  }

  createApiKey(name: string): Promise<CreatedApiKey> {
    return this.client.request("/admin/security/api-keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  revokeApiKey(id: string): Promise<void> {
    return this.client.request(`/admin/security/api-keys/${id}/revoke`, { method: "POST" });
  }

  // Two-factor authentication (any authenticated user, own account)
  twoFactorStatus(): Promise<TwoFactorStatus> {
    return this.client.request("/security/2fa");
  }

  enrollTwoFactor(): Promise<TwoFactorEnrollment> {
    return this.client.request("/security/2fa/enroll", { method: "POST" });
  }

  verifyTwoFactor(code: string): Promise<void> {
    return this.client.request("/security/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }

  disableTwoFactor(code: string): Promise<void> {
    return this.client.request("/security/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }
}
