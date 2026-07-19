import type { PrismaService } from "../../database/prisma.service";
import { GlobalConfigService } from "./global-config.service";

describe("GlobalConfigService", () => {
  function makeService() {
    const prisma = {
      globalConfigEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest
          .fn()
          .mockImplementation(({ create }) => Promise.resolve({ id: "cfg-1", ...create })),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new GlobalConfigService(prisma), prisma };
  }

  it("returns undefined when the key doesn't exist", async () => {
    const { service, prisma } = makeService();
    (prisma.globalConfigEntry.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.get("org-1", "branding.theme")).resolves.toBeUndefined();
  });

  it("returns the stored value when the key exists", async () => {
    const { service, prisma } = makeService();
    (prisma.globalConfigEntry.findUnique as jest.Mock).mockResolvedValue({
      value: { color: "green" },
    });
    await expect(service.get("org-1", "branding.theme")).resolves.toEqual({ color: "green" });
  });

  it("upserts a value scoped to the organization", async () => {
    const { service, prisma } = makeService();
    await service.set("org-1", "branding.theme", { color: "green" });
    expect(prisma.globalConfigEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_key: { organizationId: "org-1", key: "branding.theme" } },
      }),
    );
  });

  it("deletes a config entry", async () => {
    const { service, prisma } = makeService();
    await service.delete("org-1", "branding.theme");
    expect(prisma.globalConfigEntry.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", key: "branding.theme" },
    });
  });
});
