import { UserRole } from "@prisma/client";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import type { AnalyticsService } from "../../analytics/analytics.service";
import type { CustomerIntelligenceService } from "../customer-intelligence/customer-intelligence.service";
import type { ExecutiveService } from "../executive/executive.service";
import type { ForecastingService } from "../forecasting/forecasting.service";
import type { InventoryIntelligenceService } from "../inventory-intelligence/inventory-intelligence.service";
import { AiAssistantService } from "./ai-assistant.service";

const actor: RequestUser = { id: "user-1", role: UserRole.ADMIN, branchId: null };

describe("AiAssistantService (template fallback — no ANTHROPIC_API_KEY)", () => {
  let service: AiAssistantService;
  let prisma: { aiAssistantQuery: { create: jest.Mock } };
  let config: { get: jest.Mock };
  let analyticsService: { sales: jest.Mock };
  let customerIntelligence: { segments: jest.Mock };
  let inventoryIntelligence: { intelligence: jest.Mock };
  let forecastingService: { series: jest.Mock };
  let executiveService: { overview: jest.Mock };

  beforeEach(() => {
    prisma = { aiAssistantQuery: { create: jest.fn().mockResolvedValue({}) } };
    config = { get: jest.fn().mockReturnValue(undefined) }; // no ANTHROPIC_API_KEY -> template mode
    analyticsService = {
      sales: jest.fn().mockResolvedValue({
        from: "2026-07-01",
        to: "2026-07-19",
        totalRevenue: 500000,
        totalOrders: 20,
        averageOrderValue: 25000,
      }),
    };
    customerIntelligence = { segments: jest.fn().mockResolvedValue([]) };
    inventoryIntelligence = { intelligence: jest.fn().mockResolvedValue([]) };
    forecastingService = { series: jest.fn().mockResolvedValue({ modelVersion: 1, points: [] }) };
    executiveService = {
      overview: jest.fn().mockResolvedValue({ productProfitability: [], peakHours: [] }),
    };

    service = new AiAssistantService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<EnvironmentVariables, true>,
      analyticsService as unknown as AnalyticsService,
      customerIntelligence as unknown as CustomerIntelligenceService,
      inventoryIntelligence as unknown as InventoryIntelligenceService,
      forecastingService as unknown as ForecastingService,
      executiveService as unknown as ExecutiveService,
    );
  });

  it("routes a reorder question to inventory intelligence and reports FALLBACK", async () => {
    inventoryIntelligence.intelligence.mockResolvedValue([
      { name: "Granola", suggestedReorderQuantity: 2000 },
    ]);

    const result = await service.ask(actor, "What should we reorder?");

    expect(inventoryIntelligence.intelligence).toHaveBeenCalled();
    expect(result.outcome).toBe("FALLBACK");
    expect(result.answer).toContain("Granola");
    expect(result.toolCalls[0]!.tool).toBe("get_reorder_suggestions");
  });

  it("routes a churn question to customer intelligence, highest risk first", async () => {
    customerIntelligence.segments.mockResolvedValue([
      { fullName: "Loyal Larry", segment: "Loyal Customers", churnRisk: 0.2, totalSpend: 10000 },
      { fullName: "At-Risk Amy", segment: "At Risk", churnRisk: 0.9, totalSpend: 5000 },
    ]);

    const result = await service.ask(actor, "Which customers are at risk of churning?");

    expect(result.answer).toContain("At-Risk Amy");
    expect(result.answer).toContain("90%");
  });

  it("routes a peak-hours question to executive overview", async () => {
    executiveService.overview.mockResolvedValue({
      productProfitability: [],
      peakHours: [
        { hour: 12, orderCount: 5 },
        { hour: 18, orderCount: 20 },
      ],
    });

    const result = await service.ask(actor, "Show my busiest hours.");

    expect(result.answer).toContain("18:00");
    expect(result.answer).toContain("20 orders");
  });

  it("falls back to a sales summary for an unmatched question", async () => {
    const result = await service.ask(actor, "How's the restaurant doing?");

    expect(analyticsService.sales).toHaveBeenCalled();
    expect(result.answer).toMatch(/ETB 5000/);
    expect(result.outcome).toBe("FALLBACK");
  });

  it("logs every query to AiAssistantQuery", async () => {
    await service.ask(actor, "How were sales yesterday?");

    expect(prisma.aiAssistantQuery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          askedByUserId: "user-1",
          question: "How were sales yesterday?",
          outcome: "FALLBACK",
        }),
      }),
    );
  });
});
