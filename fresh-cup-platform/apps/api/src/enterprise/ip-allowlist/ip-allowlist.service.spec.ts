import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { IpAllowlistService } from "./ip-allowlist.service";

describe("IpAllowlistService", () => {
  function makeService(entries: { cidr: string }[]) {
    const prisma = {
      ipAllowlistEntry: {
        findMany: jest.fn().mockResolvedValue(entries),
        findUnique: jest
          .fn()
          .mockResolvedValue(
            entries.length ? { id: "e1", organizationId: "org-1", ...entries[0] } : null,
          ),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "e1", ...data })),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new IpAllowlistService(prisma), prisma };
  }

  it("allows any IP when the organization has no entries", async () => {
    const { service } = makeService([]);
    await expect(service.isAllowed("org-1", "1.2.3.4")).resolves.toBe(true);
  });

  it("allows an IP matching an entry", async () => {
    const { service } = makeService([{ cidr: "10.0.0.0/8" }]);
    await expect(service.isAllowed("org-1", "10.1.2.3")).resolves.toBe(true);
  });

  it("rejects an IP not matching any entry", async () => {
    const { service } = makeService([{ cidr: "10.0.0.0/8" }]);
    await expect(service.isAllowed("org-1", "203.0.113.5")).resolves.toBe(false);
  });

  it("rejects when the entries exist but the ip is undefined", async () => {
    const { service } = makeService([{ cidr: "10.0.0.0/8" }]);
    await expect(service.isAllowed("org-1", undefined)).resolves.toBe(false);
  });

  it("throws NotFoundException deleting an entry from a different organization", async () => {
    const { service, prisma } = makeService([{ cidr: "10.0.0.0/8" }]);
    (prisma.ipAllowlistEntry.findUnique as jest.Mock).mockResolvedValue({
      id: "e1",
      organizationId: "org-2",
    });
    await expect(service.delete("org-1", "e1")).rejects.toThrow(NotFoundException);
  });
});
