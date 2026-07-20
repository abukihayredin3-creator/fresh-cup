import type { PrismaService } from "../../database/prisma.service";
import { EnterpriseAuditService } from "./enterprise-audit.service";

describe("EnterpriseAuditService", () => {
  function makeService() {
    const store: Array<{
      id: string;
      organizationId: string;
      actorUserId: string | null;
      eventType: string;
      detail: unknown;
      previousHash: string | null;
      hash: string;
      createdAt: Date;
    }> = [];
    let counter = 0;
    const prisma = {
      enterpriseAuditLog: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const matches = store.filter((r) => r.organizationId === where.organizationId);
          return Promise.resolve(matches.at(-1) ?? null);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(store.filter((r) => r.organizationId === where.organizationId));
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const row = { id: `log-${++counter}`, createdAt: new Date(), ...data };
          store.push(row);
          return Promise.resolve(row);
        }),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new EnterpriseAuditService(prisma), prisma, store };
  }

  it("chains each new entry to the previous entry's hash", async () => {
    const { service } = makeService();
    const first = await service.record("org-1", "SSO_LOGIN", { userId: "u1" });
    const second = await service.record("org-1", "SCIM_PROVISION", { userId: "u2" });
    expect(first.previousHash).toBeNull();
    expect(second.previousHash).toBe(first.hash);
  });

  it("verifies an untampered chain as valid", async () => {
    const { service } = makeService();
    await service.record("org-1", "SSO_LOGIN", { userId: "u1" });
    await service.record("org-1", "SCIM_PROVISION", { userId: "u2" });
    await service.record("org-1", "WEBAUTHN_REGISTER", { userId: "u3" });

    const result = await service.verifyChain("org-1");
    expect(result).toEqual({ valid: true, entriesChecked: 3 });
  });

  it("detects a tampered entry", async () => {
    const { service, store } = makeService();
    await service.record("org-1", "SSO_LOGIN", { userId: "u1" });
    await service.record("org-1", "SCIM_PROVISION", { userId: "u2" });

    // Simulate tampering: mutate the detail of the first entry after the fact.
    store[0]!.detail = { userId: "attacker-controlled" };

    const result = await service.verifyChain("org-1");
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(store[0]!.id);
  });

  it("keeps separate chains per organization", async () => {
    const { service } = makeService();
    const orgAFirst = await service.record("org-a", "SSO_LOGIN", {});
    const orgBFirst = await service.record("org-b", "SSO_LOGIN", {});
    expect(orgAFirst.previousHash).toBeNull();
    expect(orgBFirst.previousHash).toBeNull();
  });
});
