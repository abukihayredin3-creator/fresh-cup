import type {
  AuthTokens,
  RefreshTokenInput,
  RequestOtpInput,
  StaffLoginInput,
  VerifyOtpInput,
} from "@fresh-cup/types";
import type { ApiClient } from "../client";

export class AuthResource {
  constructor(private readonly client: ApiClient) {}

  requestOtp(input: RequestOtpInput): Promise<void> {
    return this.client.request("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  verifyOtp(input: VerifyOtpInput): Promise<AuthTokens> {
    return this.client.request("/auth/otp/verify", { method: "POST", body: JSON.stringify(input) });
  }

  staffLogin(input: StaffLoginInput): Promise<AuthTokens> {
    return this.client.request("/auth/staff/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  refresh(input: RefreshTokenInput): Promise<AuthTokens> {
    return this.client.request("/auth/refresh", { method: "POST", body: JSON.stringify(input) });
  }

  logout(input: RefreshTokenInput): Promise<void> {
    return this.client.request("/auth/logout", { method: "POST", body: JSON.stringify(input) });
  }
}
