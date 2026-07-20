import { Injectable } from "@nestjs/common";
import { AiInsightType, OrderStatus, type AiInsight, type Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { ReasoningCategory, ReasoningResult } from "../interfaces/ai-brain.interfaces";
import { AiBrainTenantScopeService } from "./ai-brain-tenant-scope.service";
import { MemoryEngineService } from "./memory-engine.service";
import { startOfDay } from "./trend-statistics.util";

/** Orders past the payment gate — same convention as modules/analytics's AnalyticsService. */
const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

const WINDOW_DAYS = 7;
/** A revenue/order swing smaller than this is treated as normal noise, not an anomaly. */
const ANOMALY_THRESHOLD_PCT = 10;

function pctChange(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Rule-based analysis of real business data (sales/inventory/customer
 * behavior/operational events) into a structured reasoning trace —
 * {problem, causes[], confidence, evidence[]}. Every figure quoted in a
 * cause is pulled from Prisma aggregates over this organization's own
 * history; nothing here is a hardcoded or fabricated observation, per
 * Phase 9's "do not create fake AI" design principle. Persists each
 * analysis as an AiInsight, and — for a genuine anomaly — also files an
 * observation with the Memory Engine so later analyses (and the
 * Recommendation/Decision engines) can recall it.
 */
@Injectable()
export class ReasoningEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantScope: AiBrainTenantScopeService,
    private readonly memory: MemoryEngineService,
  ) {}

  async analyze(
    organizationId: string,
    category: ReasoningCategory,
    branchId?: string,
  ): Promise<AiInsight> {
    const branchIds = await this.tenantScope.resolveBranchIds(organizationId, branchId);

    const result = await this.runAnalysis(organizationId, category, branchIds, branchId);

    const insight = await this.prisma.aiInsight.create({
      data: {
        organizationId,
        branchId: branchId ?? undefined,
        type: AiInsightType.REASONING,
        category: result.category,
        content: result as unknown as Prisma.InputJsonValue,
        confidence: result.confidence,
      },
    });

    const isAnomaly = result.causes.length > 0;
    if (isAnomaly) {
      await this.memory.record(organizationId, {
        branchId,
        memoryType: `REASONING_${result.category.toUpperCase()}`,
        data: { problem: result.problem, causes: result.causes, insightId: insight.id },
        importance: result.confidence,
      });
    }

    return insight;
  }

  private async runAnalysis(
    organizationId: string,
    category: ReasoningCategory,
    branchIds: string[],
    branchId?: string,
  ): Promise<ReasoningResult> {
    switch (category) {
      case "sales":
        return this.analyzeSales(branchIds);
      case "inventory":
        return this.analyzeInventory(branchIds);
      case "customer":
        return this.analyzeCustomer(branchIds);
      case "operational":
        return this.analyzeOperational(organizationId, branchId);
      default:
        return {
          category,
          problem: "No analysis available for this category",
          causes: [],
          confidence: 0.2,
          evidence: [],
          signals: { kind: "operational", events: [] },
        };
    }
  }

  private windowBounds(): { currentStart: Date; previousStart: Date } {
    const today = startOfDay(new Date());
    const currentStart = new Date(today.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const previousStart = new Date(today.getTime() - 2 * WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return { currentStart, previousStart };
  }

  private async analyzeSales(branchIds: string[]): Promise<ReasoningResult> {
    if (branchIds.length === 0) {
      return {
        category: "sales",
        problem: "No branches available to analyze",
        causes: [],
        confidence: 0.2,
        evidence: [],
        signals: {
          kind: "sales",
          trend: {
            currentRevenue: 0,
            previousRevenue: 0,
            revenueChangePct: 0,
            currentOrderCount: 0,
            previousOrderCount: 0,
            orderChangePct: 0,
          },
        },
      };
    }

    const { currentStart, previousStart } = this.windowBounds();
    const [currentOrders, previousOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          branchId: { in: branchIds },
          status: { in: PAID_STATUSES },
          placedAt: { gte: currentStart },
        },
        select: { total: true },
      }),
      this.prisma.order.findMany({
        where: {
          branchId: { in: branchIds },
          status: { in: PAID_STATUSES },
          placedAt: { gte: previousStart, lt: currentStart },
        },
        select: { total: true },
      }),
    ]);

    const currentRevenue = currentOrders.reduce((sum, o) => sum + o.total, 0);
    const previousRevenue = previousOrders.reduce((sum, o) => sum + o.total, 0);
    const revenueChange = pctChange(currentRevenue, previousRevenue);
    const orderChange = pctChange(currentOrders.length, previousOrders.length);

    const evidence = [
      {
        source: `Order aggregate (last ${WINDOW_DAYS} days, paid statuses)`,
        detail: `Revenue ${currentRevenue} vs previous ${previousRevenue} (${revenueChange.toFixed(1)}%), orders ${currentOrders.length} vs ${previousOrders.length}`,
      },
    ];
    const trend = {
      currentRevenue,
      previousRevenue,
      revenueChangePct: revenueChange,
      currentOrderCount: currentOrders.length,
      previousOrderCount: previousOrders.length,
      orderChangePct: orderChange,
    };

    if (revenueChange > -ANOMALY_THRESHOLD_PCT) {
      return {
        category: "sales",
        problem: "No significant revenue anomaly detected in the last 7 days",
        causes: [],
        confidence: Math.min(0.9, 0.5 + Math.min(currentOrders.length, 50) / 100),
        evidence,
        signals: { kind: "sales", trend },
      };
    }

    const causes: string[] = [];
    if (Math.abs(orderChange - revenueChange) < 5) {
      causes.push(
        `Order volume fell ${Math.abs(orderChange).toFixed(1)}%, roughly matching the revenue decline — demand-side drop, not a pricing issue`,
      );
    } else if (orderChange > -5) {
      causes.push(
        `Order volume held steady (${orderChange.toFixed(1)}%) while revenue fell — average order value dropped`,
      );
    } else {
      causes.push(`Order volume fell ${Math.abs(orderChange).toFixed(1)}%`);
    }

    const dataVolumeConfidence = Math.min(0.95, 0.4 + Math.min(previousOrders.length, 40) / 80);
    const magnitudeConfidence = Math.min(0.95, Math.abs(revenueChange) / 40);
    const confidence = Math.round(Math.min(dataVolumeConfidence, magnitudeConfidence) * 100) / 100;

    return {
      category: "sales",
      problem: `Revenue declined ${Math.abs(revenueChange).toFixed(1)}% over the last ${WINDOW_DAYS} days`,
      causes,
      confidence: Math.max(0.3, confidence),
      evidence,
      signals: { kind: "sales", trend },
    };
  }

  private async analyzeInventory(branchIds: string[]): Promise<ReasoningResult> {
    if (branchIds.length === 0) {
      return {
        category: "inventory",
        problem: "No branches available to analyze",
        causes: [],
        confidence: 0.2,
        evidence: [],
        signals: { kind: "inventory", lowStock: [] },
      };
    }

    const items = await this.prisma.inventoryItem.findMany({
      where: { branchId: { in: branchIds }, isActive: true },
      select: { id: true, name: true, currentStock: true, reorderThreshold: true },
    });

    const lowStock = items
      .filter((item) => Number(item.currentStock) <= Number(item.reorderThreshold))
      .map((item) => ({
        id: item.id,
        name: item.name,
        currentStock: Number(item.currentStock),
        reorderThreshold: Number(item.reorderThreshold),
      }));

    const evidence = [
      {
        source: "InventoryItem (active items)",
        detail: `${lowStock.length} of ${items.length} active item(s) at or below their reorder threshold`,
      },
    ];

    if (lowStock.length === 0) {
      return {
        category: "inventory",
        problem: "No inventory items are currently at risk of stockout",
        causes: [],
        confidence: items.length > 0 ? 0.85 : 0.3,
        evidence,
        signals: { kind: "inventory", lowStock: [] },
      };
    }

    const causes = lowStock
      .slice(0, 5)
      .map(
        (item) =>
          `${item.name} is at ${item.currentStock} (reorder threshold ${item.reorderThreshold})`,
      );

    return {
      category: "inventory",
      problem: `${lowStock.length} inventory item(s) at or below reorder threshold`,
      causes,
      confidence: Math.min(0.95, 0.6 + lowStock.length / items.length / 2),
      evidence,
      signals: { kind: "inventory", lowStock },
    };
  }

  private async analyzeCustomer(branchIds: string[]): Promise<ReasoningResult> {
    if (branchIds.length === 0) {
      return {
        category: "customer",
        problem: "No branches available to analyze",
        causes: [],
        confidence: 0.2,
        evidence: [],
        signals: {
          kind: "customer",
          trend: {
            currentCustomers: 0,
            previousCustomers: 0,
            customerChangePct: 0,
            repeatChangePct: 0,
          },
        },
      };
    }

    const { currentStart, previousStart } = this.windowBounds();
    const [currentOrders, previousOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          branchId: { in: branchIds },
          status: { in: PAID_STATUSES },
          placedAt: { gte: currentStart },
        },
        select: { userId: true },
      }),
      this.prisma.order.findMany({
        where: {
          branchId: { in: branchIds },
          status: { in: PAID_STATUSES },
          placedAt: { gte: previousStart, lt: currentStart },
        },
        select: { userId: true },
      }),
    ]);

    const currentCustomers = new Set(currentOrders.map((o) => o.userId));
    const previousCustomers = new Set(previousOrders.map((o) => o.userId));
    const currentOrdersPerCustomer = currentCustomers.size
      ? currentOrders.length / currentCustomers.size
      : 0;
    const previousOrdersPerCustomer = previousCustomers.size
      ? previousOrders.length / previousCustomers.size
      : 0;
    const customerChange = pctChange(currentCustomers.size, previousCustomers.size);
    const repeatChange = pctChange(currentOrdersPerCustomer, previousOrdersPerCustomer);

    const evidence = [
      {
        source: `Order aggregate (last ${WINDOW_DAYS} days, distinct customers)`,
        detail: `${currentCustomers.size} distinct customer(s) vs previous ${previousCustomers.size}; ${currentOrdersPerCustomer.toFixed(2)} orders/customer vs previous ${previousOrdersPerCustomer.toFixed(2)}`,
      },
    ];
    const trend = {
      currentCustomers: currentCustomers.size,
      previousCustomers: previousCustomers.size,
      customerChangePct: customerChange,
      repeatChangePct: repeatChange,
    };

    if (
      Math.abs(customerChange) < ANOMALY_THRESHOLD_PCT &&
      Math.abs(repeatChange) < ANOMALY_THRESHOLD_PCT
    ) {
      return {
        category: "customer",
        problem: "No significant change in customer activity",
        causes: [],
        confidence: currentCustomers.size > 5 ? 0.8 : 0.4,
        evidence,
        signals: { kind: "customer", trend },
      };
    }

    const causes: string[] = [];
    if (customerChange <= -ANOMALY_THRESHOLD_PCT) {
      causes.push(`Distinct customer count fell ${Math.abs(customerChange).toFixed(1)}%`);
    }
    if (repeatChange <= -ANOMALY_THRESHOLD_PCT) {
      causes.push(
        `Repeat-order rate fell ${Math.abs(repeatChange).toFixed(1)}% (fewer orders per customer)`,
      );
    }
    if (customerChange >= ANOMALY_THRESHOLD_PCT) {
      causes.push(`Distinct customer count grew ${customerChange.toFixed(1)}%`);
    }

    return {
      category: "customer",
      problem: "Customer activity shifted significantly over the last 7 days",
      causes,
      confidence: Math.min(0.9, 0.4 + Math.min(currentCustomers.size, 30) / 60),
      evidence,
      signals: { kind: "customer", trend },
    };
  }

  private async analyzeOperational(
    organizationId: string,
    branchId?: string,
  ): Promise<ReasoningResult> {
    const recent = await this.memory.mostImportant(organizationId, branchId, 10);
    const notable = recent.filter((m) => m.importance >= 0.6);

    const evidence = [
      {
        source: "AiMemory (most important recent entries)",
        detail: `${notable.length} of ${recent.length} recent memories have importance >= 0.6`,
      },
    ];

    if (notable.length === 0) {
      return {
        category: "operational",
        problem: "No notable operational events recorded recently",
        causes: [],
        confidence: recent.length > 0 ? 0.6 : 0.3,
        evidence,
        signals: { kind: "operational", events: [] },
      };
    }

    const causes = notable
      .slice(0, 5)
      .map(
        (m) =>
          `${m.memoryType} recorded at ${m.createdAt.toISOString()} (importance ${m.importance})`,
      );
    const events = notable.slice(0, 5).map((m) => ({
      memoryType: m.memoryType,
      importance: m.importance,
      createdAt: m.createdAt.toISOString(),
    }));

    return {
      category: "operational",
      problem: `${notable.length} notable operational event(s) recorded recently`,
      causes,
      confidence: Math.min(0.9, notable.reduce((sum, m) => sum + m.importance, 0) / notable.length),
      evidence,
      signals: { kind: "operational", events },
    };
  }
}
