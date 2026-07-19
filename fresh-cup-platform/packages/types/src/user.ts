import type { Locale } from "./common";
import type { UserRole } from "./enums";

export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  fullName: string;
  role: UserRole;
  branchId: string | null;
  locale: Locale;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface UpdateProfileInput {
  fullName?: string;
  email?: string;
  locale?: Locale;
}
