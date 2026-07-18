import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { RequestUser } from "../types/request-user.interface";

/**
 * Enforced at the service layer (not just the controller) per
 * docs/ARCHITECTURE.md: a manager/staff token for one branch must never be
 * able to read or write another branch's data. Admins act across branches.
 */
export function assertBranchAccess(actor: RequestUser, branchId: string): void {
  if (actor.role === UserRole.ADMIN) {
    return;
  }
  if (actor.branchId === branchId) {
    return;
  }
  throw new ForbiddenException("You do not have permission to manage this branch's resources");
}
