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

/** Admin-only view — adds fields that must never appear in a customer's own /users/me response. */
export interface AdminUser extends User {
  isOwner: boolean;
  departmentId: string | null;
  salary: number | null;
  twoFactorEnabled: boolean;
}

export interface AdminUpdateUserInput {
  fullName?: string;
  role?: UserRole;
  branchId?: string;
  isActive?: boolean;
  isOwner?: boolean;
  departmentId?: string;
  salary?: number;
}

export interface AdminCreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  branchId?: string;
}
