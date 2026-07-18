import type { UserRole } from "@prisma/client";

/** The shape of `request.user` after the JWT strategy validates an access token. */
export interface RequestUser {
  id: string;
  role: UserRole;
  branchId: string | null;
}

declare module "express" {
  interface Request {
    user?: RequestUser;
  }
}
