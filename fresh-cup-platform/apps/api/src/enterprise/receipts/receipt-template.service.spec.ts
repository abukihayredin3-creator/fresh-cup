import type { PrismaService } from "../../database/prisma.service";
import { ReceiptTemplateService } from "./receipt-template.service";

describe("ReceiptTemplateService", () => {
  function makeService(overrides: { template?: unknown } = {}) {
    const prisma = {
      receiptTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(overrides.template ?? null),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new ReceiptTemplateService(prisma), prisma };
  }

  it("returns a built-in default when no template is configured for the country", async () => {
    const { service } = makeService({ template: null });
    await expect(service.resolveTemplate("org-1", "FR")).resolves.toEqual({
      countryCode: "FR",
      legalFooterText: null,
      showTaxBreakdown: true,
      showVatNumber: false,
      vatNumber: null,
      dateFormat: "YYYY-MM-DD HH:mm",
    });
  });

  it("returns the configured template when one exists", async () => {
    const template = {
      countryCode: "ET",
      legalFooterText: "Thank you!",
      showTaxBreakdown: true,
      showVatNumber: true,
      vatNumber: "ET-12345",
      dateFormat: "DD/MM/YYYY",
    };
    const { service } = makeService({ template });
    await expect(service.resolveTemplate("org-1", "ET")).resolves.toEqual(template);
  });

  it("formats a date against a token string", () => {
    const { service } = makeService();
    const date = new Date(2026, 6, 20, 9, 5, 3);
    expect(service.formatDate(date, "YYYY-MM-DD HH:mm:ss")).toBe("2026-07-20 09:05:03");
    expect(service.formatDate(date, "DD/MM/YYYY")).toBe("20/07/2026");
  });
});
