import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ForecastGranularity, ForecastMetric, PurchaseOrderStatus } from "@prisma/client";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import { PrismaService } from "../../../database/prisma.service";
import { ForecastingService } from "../../../modules/intelligence/forecasting/forecasting.service";
import { InventoryIntelligenceService } from "../../../modules/intelligence/inventory-intelligence/inventory-intelligence.service";
import { mean } from "../../../modules/intelligence/ml/stats.util";
import type { AiInsightDto } from "../../dto/ai-insight.dto";
import { confidenceScore } from "../../utils/confidence.util";
import { ExplanationService } from "../explanation.service";

function toBirr(minorUnits: number): number {
  return Math.round(minorUnits) / 100;
}

/**
 * Restocking/waste predictions wrap Phase 6's InventoryIntelligenceService
 * directly. Supplier optimization is net-new (Phase 6 had no supplier
 * scoring), computed here from PurchaseOrder lead-time/reliability history
 * — no Phase 6 equivalent to duplicate.
 */
@Injectable()
export class InventoryAiService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
    private readonly inventoryIntelligence: InventoryIntelligenceService,
    private readonly forecastingService: ForecastingService,
    private readonly explanation: ExplanationService,
  ) {}

  async restockingRecommendations(branchId?: string): Promise<AiInsightDto[]> {
    const items = await this.inventoryIntelligence.intelligence(branchId);
    const toReorder = items.filter((i) => i.suggestedReorderQuantity > 0);
    return Promise.all(
      toReorder.map(async (item) => ({
        title: `Restock: ${item.name}`,
        explanation: await this.explanation.explain(`Restock recommendation for ${item.name}`, {
          currentStock: item.currentStock,
          suggestedReorderQuantity: item.suggestedReorderQuantity,
          daysUntilStockout: item.daysUntilStockout,
          suggestedReorderCostEtb: toBirr(item.suggestedReorderCost),
        }),
        confidence: confidenceScore([item.avgDailyConsumption, item.currentStock]),
        data: item,
      })),
    );
  }

  async wastePrediction(branchId?: string): Promise<AiInsightDto[]> {
    const items = await this.inventoryIntelligence.intelligence(branchId);
    const wasteProne = items.filter((i) => i.wasteProbability > 0.1);
    return Promise.all(
      wasteProne.map(async (item) => ({
        title: `Waste risk: ${item.name}`,
        explanation: await this.explanation.explain(`Waste risk for ${item.name}`, {
          wasteProbabilityPercent: Math.round(item.wasteProbability * 100),
          expiryRiskPercent: item.expiryRisk !== null ? Math.round(item.expiryRisk * 100) : null,
        }),
        confidence: confidenceScore([item.avgDailyConsumption]),
        data: item,
      })),
    );
  }

  async ingredientDemandForecast(branchId?: string): Promise<AiInsightDto> {
    if (!this.config.get("AI_FORECASTING_ENABLED", { infer: true })) {
      throw new ForbiddenException(
        "Ingredient demand forecasting is disabled (AI_FORECASTING_ENABLED=false)",
      );
    }
    const { modelVersion, points } = await this.forecastingService.series(
      ForecastMetric.INGREDIENT_DEMAND,
      ForecastGranularity.DAILY,
      branchId,
    );
    const future = points.filter((p) => p.targetPeriodStart > new Date());
    const dataPoints = { modelVersion, horizonDays: future.length };
    return {
      title: "Ingredient demand forecast",
      explanation: await this.explanation.explain("Ingredient demand forecast", dataPoints),
      confidence: future[0] ? Number(future[0].confidence) : 0.1,
      data: { modelVersion, points: future },
    };
  }

  async supplierOptimization(branchId?: string): Promise<AiInsightDto[]> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { isActive: true, ...(branchId ? { branchId } : {}) },
      include: { purchaseOrders: { where: { status: { not: PurchaseOrderStatus.DRAFT } } } },
    });

    return Promise.all(
      suppliers
        .filter((s) => s.purchaseOrders.length > 0)
        .map(async (supplier) => {
          const received = supplier.purchaseOrders.filter(
            (po) => po.status === PurchaseOrderStatus.RECEIVED && po.submittedAt && po.receivedAt,
          );
          const leadTimesDays = received.map(
            (po) => (po.receivedAt!.getTime() - po.submittedAt!.getTime()) / (24 * 60 * 60 * 1000),
          );
          const cancelled = supplier.purchaseOrders.filter(
            (po) => po.status === PurchaseOrderStatus.CANCELLED,
          );
          const reliabilityRate =
            supplier.purchaseOrders.length > 0
              ? received.length / (received.length + cancelled.length || 1)
              : 0;

          const dataPoints = {
            totalOrders: supplier.purchaseOrders.length,
            avgLeadTimeDays: leadTimesDays.length
              ? Math.round(mean(leadTimesDays) * 10) / 10
              : null,
            reliabilityRate: Math.round(reliabilityRate * 100) / 100,
          };

          return {
            title: `Supplier: ${supplier.name}`,
            explanation: await this.explanation.explain(
              `Supplier performance for ${supplier.name}`,
              dataPoints,
            ),
            confidence: confidenceScore(leadTimesDays.length ? leadTimesDays : [0]),
            data: dataPoints,
          };
        }),
    );
  }
}
