import { AiPriority } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import type { ReasoningResult } from "../interfaces/ai-brain.interfaces";
import { RecommendationEngineService } from "../services/recommendation-engine.service";
import { ReasoningEngineService } from "../services/reasoning-engine.service";

function insightWith(content: ReasoningResult, id = "insight-1") {
  return { id, content, confidence: content.confidence };
}

describe("RecommendationEngineService", () => {
  let service: RecommendationEngineService;
  let prisma: { aiRecommendation: { create: jest.Mock } };
  let reasoning: { analyze: jest.Mock };

  beforeEach(() => {
    prisma = {
      aiRecommendation: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "rec-1", ...data })),
      },
    };
    reasoning = { analyze: jest.fn() };
    service = new RecommendationEngineService(
      prisma as unknown as PrismaService,
      reasoning as unknown as ReasoningEngineService,
    );
  });

  it("produces no recommendations when every category is anomaly-free", async () => {
    reasoning.analyze.mockImplementation((_org: string, category: string) =>
      Promise.resolve(
        insightWith({
          category: category as ReasoningResult["category"],
          problem: "nothing notable",
          causes: [],
          confidence: 0.8,
          evidence: [],
          signals: { kind: "operational", events: [] },
        }),
      ),
    );

    const result = await service.generate("org-1", "branch-1");

    expect(result).toEqual([]);
    expect(prisma.aiRecommendation.create).not.toHaveBeenCalled();
  });

  it("recommends reordering each low-stock item with a real deficit-based impact", async () => {
    reasoning.analyze.mockImplementation((_org: string, category: string) => {
      if (category === "inventory") {
        return Promise.resolve(
          insightWith({
            category: "inventory",
            problem: "1 inventory item(s) at or below reorder threshold",
            causes: ["Avocado is at 2 (reorder threshold 10)"],
            confidence: 0.7,
            evidence: [],
            signals: {
              kind: "inventory",
              lowStock: [{ id: "item-1", name: "Avocado", currentStock: 2, reorderThreshold: 10 }],
            },
          }),
        );
      }
      return Promise.resolve(
        insightWith({
          category: category as ReasoningResult["category"],
          problem: "nothing notable",
          causes: [],
          confidence: 0.8,
          evidence: [],
          signals: { kind: "operational", events: [] },
        }),
      );
    });

    const result = await service.generate("org-1", "branch-1", ["inventory"]);

    expect(result).toHaveLength(1);
    const data = prisma.aiRecommendation.create.mock.calls[0][0].data;
    expect(data.title).toBe("Reorder Avocado");
    expect(data.impact).toContain("Avocado");
    expect(data.confidence).toBe(0.7);
    expect(data.organizationId).toBe("org-1");
    expect(data.branchId).toBe("branch-1");
  });

  it("recommends a promotional campaign for a demand-driven sales decline", async () => {
    reasoning.analyze.mockResolvedValue(
      insightWith({
        category: "sales",
        problem: "Revenue declined 40.0% over the last 7 days",
        causes: ["Order volume fell 38.0%, roughly matching the revenue decline"],
        confidence: 0.9,
        evidence: [],
        signals: {
          kind: "sales",
          trend: {
            currentRevenue: 600,
            previousRevenue: 1000,
            revenueChangePct: -40,
            currentOrderCount: 6,
            previousOrderCount: 10,
            orderChangePct: -38,
          },
        },
      }),
    );

    const result = await service.generate("org-1", undefined, ["sales"]);

    expect(result).toHaveLength(1);
    const data = prisma.aiRecommendation.create.mock.calls[0][0].data;
    expect(data.title).toMatch(/promotional campaign/i);
    expect(data.priority).toBe(AiPriority.CRITICAL);
  });

  it("recommends a pricing review when revenue fell but order volume held steady", async () => {
    reasoning.analyze.mockResolvedValue(
      insightWith({
        category: "sales",
        problem: "Revenue declined 20.0% over the last 7 days",
        causes: [
          "Order volume held steady (2.0%) while revenue fell — average order value dropped",
        ],
        confidence: 0.6,
        evidence: [],
        signals: {
          kind: "sales",
          trend: {
            currentRevenue: 800,
            previousRevenue: 1000,
            revenueChangePct: -20,
            currentOrderCount: 10,
            previousOrderCount: 10,
            orderChangePct: 0,
          },
        },
      }),
    );

    await service.generate("org-1", undefined, ["sales"]);

    const data = prisma.aiRecommendation.create.mock.calls[0][0].data;
    expect(data.title).toMatch(/discounting/i);
  });

  it("recommends a win-back campaign when distinct customers dropped significantly", async () => {
    reasoning.analyze.mockResolvedValue(
      insightWith({
        category: "customer",
        problem: "Customer activity shifted significantly over the last 7 days",
        causes: ["Distinct customer count fell 50.0%"],
        confidence: 0.65,
        evidence: [],
        signals: {
          kind: "customer",
          trend: {
            currentCustomers: 2,
            previousCustomers: 4,
            customerChangePct: -50,
            repeatChangePct: 0,
          },
        },
      }),
    );

    await service.generate("org-1", undefined, ["customer"]);

    const data = prisma.aiRecommendation.create.mock.calls[0][0].data;
    expect(data.title).toMatch(/win-back|loyalty/i);
  });

  it("assigns LOW priority to a low-confidence, non-severe recommendation", async () => {
    reasoning.analyze.mockResolvedValue(
      insightWith({
        category: "customer",
        problem: "Customer activity shifted significantly over the last 7 days",
        causes: ["Distinct customer count fell 12.0%"],
        confidence: 0.3,
        evidence: [],
        signals: {
          kind: "customer",
          trend: {
            currentCustomers: 9,
            previousCustomers: 10,
            customerChangePct: -12,
            repeatChangePct: 0,
          },
        },
      }),
    );

    await service.generate("org-1", undefined, ["customer"]);

    const data = prisma.aiRecommendation.create.mock.calls[0][0].data;
    expect(data.priority).toBe(AiPriority.LOW);
  });
});
