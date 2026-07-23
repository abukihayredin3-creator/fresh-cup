import { UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { AiBrainTenantScopeService } from "../../ai-brain/services/ai-brain-tenant-scope.service";
import { AiCopilotScopeService } from "../services/ai-copilot-scope.service";

describe("AiCopilotScopeService", () => {
  let service: AiCopilotScopeService;
  let tenantScope: { resolveBranchIds: jest.Mock };

  beforeEach(() => {
    tenantScope = { resolveBranchIds: jest.fn().mockResolvedValue(["branch-1", "branch-2"]) };
    service = new AiCopilotScopeService(tenantScope as unknown as AiBrainTenantScopeService);
  });

  it("forces a manager to their own branch regardless of the requested branchId", async () => {
    const manager: RequestUser = { id: "u1", role: UserRole.MANAGER, branchId: "branch-1" };

    await service.resolveBranches(manager, "org-1", "branch-2");

    expect(tenantScope.resolveBranchIds).toHaveBeenCalledWith("org-1", "branch-1");
  });

  it("forces staff to their own branch too", async () => {
    const staff: RequestUser = { id: "u2", role: UserRole.STAFF, branchId: "branch-1" };

    await service.resolveBranches(staff, "org-1", "branch-2");

    expect(tenantScope.resolveBranchIds).toHaveBeenCalledWith("org-1", "branch-1");
  });

  it("returns no branches for a branchless manager rather than falling back to org-wide", async () => {
    const manager: RequestUser = { id: "u3", role: UserRole.MANAGER, branchId: null };

    const result = await service.resolveBranches(manager, "org-1", undefined);

    expect(result).toEqual([]);
    expect(tenantScope.resolveBranchIds).not.toHaveBeenCalled();
  });

  it("lets an admin request any branch within the organization", async () => {
    const admin: RequestUser = { id: "u4", role: UserRole.ADMIN, branchId: null };

    await service.resolveBranches(admin, "org-1", "branch-2");

    expect(tenantScope.resolveBranchIds).toHaveBeenCalledWith("org-1", "branch-2");
  });

  it("lets an admin request every branch in the organization when no branchId is given", async () => {
    const admin: RequestUser = { id: "u5", role: UserRole.ADMIN, branchId: null };

    const result = await service.resolveBranches(admin, "org-1", undefined);

    expect(tenantScope.resolveBranchIds).toHaveBeenCalledWith("org-1", undefined);
    expect(result).toEqual(["branch-1", "branch-2"]);
  });
});
