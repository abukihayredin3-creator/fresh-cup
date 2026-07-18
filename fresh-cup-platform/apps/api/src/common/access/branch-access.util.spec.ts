import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { assertBranchAccess } from "./branch-access.util";

describe("assertBranchAccess", () => {
  it("allows an admin to act on any branch", () => {
    expect(() =>
      assertBranchAccess(
        { id: "u1", role: UserRole.ADMIN, branchId: "other-branch" },
        "target-branch",
      ),
    ).not.toThrow();
  });

  it("allows a manager to act on their own branch", () => {
    expect(() =>
      assertBranchAccess({ id: "u1", role: UserRole.MANAGER, branchId: "branch-1" }, "branch-1"),
    ).not.toThrow();
  });

  it("blocks a manager from acting on a different branch", () => {
    expect(() =>
      assertBranchAccess({ id: "u1", role: UserRole.MANAGER, branchId: "branch-1" }, "branch-2"),
    ).toThrow(ForbiddenException);
  });

  it("blocks a staff user with no branch assigned", () => {
    expect(() =>
      assertBranchAccess({ id: "u1", role: UserRole.STAFF, branchId: null }, "branch-1"),
    ).toThrow(ForbiddenException);
  });
});
