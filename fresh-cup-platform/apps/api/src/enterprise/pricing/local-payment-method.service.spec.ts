import { PaymentMethod } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import { LocalPaymentMethodService } from "./local-payment-method.service";

describe("LocalPaymentMethodService", () => {
  function makeService() {
    const prisma = {
      localPaymentMethodConfig: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new LocalPaymentMethodService(prisma), prisma };
  }

  it("defaults isEnabled and sortOrder when creating a config", async () => {
    const { service } = makeService();
    const result = await service.setConfig("org-1", {
      countryCode: "ET",
      method: PaymentMethod.TELEBIRR,
    });
    expect(result).toMatchObject({
      organizationId: "org-1",
      countryCode: "ET",
      method: PaymentMethod.TELEBIRR,
      isEnabled: true,
      sortOrder: 0,
    });
  });

  it("lists enabled methods for a country ordered by sortOrder", async () => {
    const { service, prisma } = makeService();
    await service.listForCountry("org-1", "ET");
    expect(prisma.localPaymentMethodConfig.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", countryCode: "ET", isEnabled: true },
      orderBy: { sortOrder: "asc" },
    });
  });
});
