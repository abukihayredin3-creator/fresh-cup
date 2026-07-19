/**
 * Generates ~75 days of realistic historical Order/OrderItem/Payment/
 * LoyaltyLedger data (plus matching InventoryTransaction deductions/waste
 * for the trailing 14 days) so Phase 6's forecasting, RFM segmentation,
 * inventory intelligence, and recommendation engine have real signal to
 * work with in development — none of that is meaningful against an empty
 * order history.
 *
 * Deliberately NOT part of prisma/seed.ts: that script's fixtures are
 * idempotent catalog/inventory/coupon data meant to describe "what the
 * restaurant sells" (see its header comment, which explicitly excludes
 * order/payment rows as "transactional data, not fixtures"). This script
 * generates that transactional history instead — a different kind of seed,
 * run explicitly and only in development. Run after `prisma:seed`:
 *
 *   pnpm --filter @fresh-cup/api prisma:demo-data
 *
 * Idempotent in spirit: every row it creates carries an idempotencyKey (or
 * providerReference) prefixed "demo-", and the script skips entirely if
 * demo orders already exist, so re-running never piles up duplicate
 * history.
 */
import {
  PrismaClient,
  OrderType,
  OrderStatus,
  PaymentProvider,
  PaymentMethod,
  PaymentStatus,
  LoyaltyReason,
  InventoryTransactionReason,
  UserRole,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

const HISTORY_DAYS = 75;
const CONSUMPTION_WINDOW_DAYS = 14;
const CASH_METHODS: PaymentMethod[] = [PaymentMethod.CASH];
const CHAPA_METHODS: PaymentMethod[] = [
  PaymentMethod.TELEBIRR,
  PaymentMethod.CBE_BIRR,
  PaymentMethod.HELLOCASH,
  PaymentMethod.AMOLE,
  PaymentMethod.CARD,
];
const LOYALTY_MINOR_UNITS_PER_POINT = 1000;

interface DemoCustomer {
  id: string;
  /** Days-ago range in which this customer is willing to place an order — shapes RFM segments on purpose. */
  activeFrom: number;
  activeTo: number;
  /** Relative likelihood of being picked on an eligible day. */
  weight: number;
  usedWelcomeCoupon: boolean;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)]!;
}

/** Weighted toward lunch (11-14) and dinner (17-20), a long tail otherwise. */
function weightedHour(): number {
  const buckets: [number, number, number][] = [
    [7, 10, 2],
    [10, 11, 3],
    [11, 14, 8],
    [14, 17, 3],
    [17, 20, 7],
    [20, 22, 2],
  ];
  const total = buckets.reduce((sum, [, , w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [start, end, weight] of buckets) {
    if (roll < weight) return randomInt(start, end - 1);
    roll -= weight;
  }
  return 12;
}

async function alreadyGenerated(): Promise<boolean> {
  const count = await prisma.order.count({ where: { idempotencyKey: { startsWith: "demo-" } } });
  return count > 0;
}

async function createDemoCustomers(branchId: string): Promise<DemoCustomer[]> {
  const specs: { count: number; activeFrom: number; activeTo: number; weight: number }[] = [
    // "Champions"/"Loyal" — order throughout the whole window, often.
    { count: 6, activeFrom: 0, activeTo: HISTORY_DAYS, weight: 5 },
    // "Need Attention" — a handful of orders, scattered.
    { count: 6, activeFrom: 0, activeTo: HISTORY_DAYS, weight: 1 },
    // "New Customers" — only in the last ~10 days.
    { count: 6, activeFrom: 0, activeTo: 10, weight: 3 },
    // "At Risk"/"Lost" — only ordered in the older half of the window, nothing recently.
    { count: 6, activeFrom: 30, activeTo: HISTORY_DAYS, weight: 2 },
  ];

  const customers: DemoCustomer[] = [];
  let index = 0;
  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      index++;
      const phone = `+2519${(10000000 + index).toString().slice(0, 8)}`;
      const email = `demo.customer${index}@freshcup.dev`;
      const existing = await prisma.user.findUnique({ where: { phone } });
      const user =
        existing ??
        (await prisma.user.create({
          data: {
            phone,
            email,
            fullName: `Demo Customer ${index}`,
            role: UserRole.CUSTOMER,
            branchId,
            createdAt: new Date(Date.now() - spec.activeTo * 24 * 60 * 60 * 1000),
          },
        }));
      customers.push({
        id: user.id,
        activeFrom: spec.activeFrom,
        activeTo: spec.activeTo,
        weight: spec.weight,
        usedWelcomeCoupon: false,
      });
    }
  }
  return customers;
}

function pickCustomerForDay(customers: DemoCustomer[], daysAgo: number): DemoCustomer | null {
  const eligible = customers.filter((c) => daysAgo >= c.activeFrom && daysAgo <= c.activeTo);
  if (eligible.length === 0) return null;
  const total = eligible.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const customer of eligible) {
    if (roll < customer.weight) return customer;
    roll -= customer.weight;
  }
  return eligible[eligible.length - 1]!;
}

async function main() {
  if (await alreadyGenerated()) {
    // eslint-disable-next-line no-console
    console.log("Demo order history already present — skipping.");
    return;
  }

  // Named lookup, not findFirst(): dev/CI databases accumulate disposable
  // "Test Branch xxxxx" rows from e2e runs, and findFirst() has no
  // guarantee of picking the real seeded branch over one of those.
  const branch = await prisma.branch.findFirst({ where: { name: "Fresh Cup — Merkato" } });
  if (!branch) {
    throw new Error("No branch found — run `pnpm prisma:seed` first.");
  }

  const [menuItems, inventoryItems, coupon, recipeLines] = await Promise.all([
    prisma.menuItem.findMany({ where: { branchId: branch.id, isAvailable: true } }),
    prisma.inventoryItem.findMany({ where: { branchId: branch.id, isActive: true } }),
    prisma.coupon.findUnique({ where: { code: "WELCOME10" } }),
    prisma.recipeIngredient.findMany({ where: { menuItem: { branchId: branch.id } } }),
  ]);
  if (menuItems.length === 0) {
    throw new Error("No menu items found — run `pnpm prisma:seed` first.");
  }

  const recipeByMenuItem = new Map<
    string,
    { inventoryItemId: string; quantityPerUnit: number }[]
  >();
  for (const line of recipeLines) {
    const list = recipeByMenuItem.get(line.menuItemId) ?? [];
    list.push({
      inventoryItemId: line.inventoryItemId,
      quantityPerUnit: Number(line.quantityPerUnit),
    });
    recipeByMenuItem.set(line.menuItemId, list);
  }

  const customers = await createDemoCustomers(branch.id);
  const loyaltyBalanceByCustomer = new Map<string, number>();
  const inventoryDeltaByItem = new Map<string, number>();

  let ordersCreated = 0;

  for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo--) {
    const dayDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
    const orderCount = isWeekend ? randomInt(6, 13) : randomInt(3, 9);

    for (let i = 0; i < orderCount; i++) {
      const customer = pickCustomerForDay(customers, daysAgo);
      if (!customer) continue;

      const placedAt = new Date(dayDate);
      placedAt.setHours(weightedHour(), randomInt(0, 59), randomInt(0, 59), 0);
      if (placedAt.getTime() > Date.now()) continue;

      const lineCount = randomInt(1, 3);
      const chosenItems = new Set<string>();
      while (chosenItems.size < lineCount && chosenItems.size < menuItems.length) {
        chosenItems.add(pick(menuItems).id);
      }
      const lines = Array.from(chosenItems).map((menuItemId) => {
        const menuItem = menuItems.find((m) => m.id === menuItemId)!;
        const quantity = randomInt(1, 2);
        return {
          menuItem,
          quantity,
          lineTotal: menuItem.basePrice * quantity,
        };
      });
      const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

      let discountTotal = 0;
      let applyCoupon = false;
      if (
        coupon &&
        !customer.usedWelcomeCoupon &&
        subtotal >= (coupon.minOrderTotal ?? 0) &&
        Math.random() < 0.15
      ) {
        discountTotal = Math.round((subtotal * coupon.value) / 100);
        applyCoupon = true;
      }
      const total = Math.max(0, subtotal - discountTotal);

      const orderType = Math.random() < 0.5 ? OrderType.DINE_IN : OrderType.PICKUP;
      const method = Math.random() < 0.35 ? pick(CASH_METHODS) : pick(CHAPA_METHODS);
      const provider = method === PaymentMethod.CASH ? PaymentProvider.CASH : PaymentProvider.CHAPA;

      const prevBalance = loyaltyBalanceByCustomer.get(customer.id) ?? 0;
      const pointsEarned = Math.floor(total / LOYALTY_MINOR_UNITS_PER_POINT);
      const newBalance = prevBalance + pointsEarned;
      loyaltyBalanceByCustomer.set(customer.id, newBalance);

      const idempotencyKey = `demo-${randomUUID()}`;
      const order = await prisma.order.create({
        data: {
          branchId: branch.id,
          userId: customer.id,
          orderType,
          status: OrderStatus.COMPLETED,
          subtotal,
          discountTotal,
          total,
          idempotencyKey,
          placedAt,
          confirmedAt: new Date(placedAt.getTime() + 2 * 60 * 1000),
          preparingAt: new Date(placedAt.getTime() + 3 * 60 * 1000),
          readyAt: new Date(placedAt.getTime() + 8 * 60 * 1000),
          couponId: applyCoupon ? coupon!.id : undefined,
          items: {
            create: lines.map((l) => ({
              menuItemId: l.menuItem.id,
              nameSnapshot: l.menuItem.nameEn,
              unitPrice: l.menuItem.basePrice,
              quantity: l.quantity,
              lineTotal: l.lineTotal,
              prepTimeSeconds: l.menuItem.prepTimeSeconds,
              stationId: l.menuItem.stationId,
            })),
          },
          payments: {
            create: [
              {
                provider,
                method,
                providerReference: `demo-pay-${randomUUID()}`,
                amount: total,
                status: PaymentStatus.SUCCEEDED,
                initiatedAt: placedAt,
                completedAt: new Date(placedAt.getTime() + 60 * 1000),
              },
            ],
          },
          loyaltyEntries: {
            create:
              pointsEarned > 0
                ? [
                    {
                      userId: customer.id,
                      pointsDelta: pointsEarned,
                      reason: LoyaltyReason.ORDER_EARNED,
                      balanceAfter: newBalance,
                      createdAt: placedAt,
                    },
                  ]
                : [],
          },
        },
      });

      if (applyCoupon) {
        customer.usedWelcomeCoupon = true;
        await prisma.couponRedemption.create({
          data: {
            couponId: coupon!.id,
            userId: customer.id,
            orderId: order.id,
            redeemedAt: placedAt,
          },
        });
      }

      // Only the trailing consumption window feeds InventoryService.predictedShortages /
      // InventoryIntelligenceService — older deductions would just be discarded anyway.
      if (daysAgo <= CONSUMPTION_WINDOW_DAYS) {
        for (const line of lines) {
          const recipe = recipeByMenuItem.get(line.menuItem.id) ?? [];
          for (const ingredient of recipe) {
            const delta = -(ingredient.quantityPerUnit * line.quantity);
            await prisma.inventoryTransaction.create({
              data: {
                inventoryItemId: ingredient.inventoryItemId,
                delta,
                reason: InventoryTransactionReason.ORDER_DEDUCTION,
                note: `Demo deduction: ${order.id}`,
                createdAt: placedAt,
              },
            });
            inventoryDeltaByItem.set(
              ingredient.inventoryItemId,
              (inventoryDeltaByItem.get(ingredient.inventoryItemId) ?? 0) + delta,
            );
          }
        }
      }

      ordersCreated++;
    }
  }

  // A handful of waste entries in the trailing window, so wasteProbability has signal too.
  const wasteCandidates = inventoryItems.filter(() => Math.random() < 0.4);
  for (const item of wasteCandidates) {
    const daysAgo = randomInt(1, CONSUMPTION_WINDOW_DAYS);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const wasted = Math.round(Number(item.currentStock) * (randomInt(2, 8) / 100));
    if (wasted <= 0) continue;
    await prisma.inventoryTransaction.create({
      data: {
        inventoryItemId: item.id,
        delta: -wasted,
        reason: InventoryTransactionReason.WASTE,
        note: "Demo waste",
        createdAt,
      },
    });
    inventoryDeltaByItem.set(item.id, (inventoryDeltaByItem.get(item.id) ?? 0) + -wasted);
  }

  // Apply the accumulated deductions to InventoryItem.currentStock, floored so demo stock
  // dips low enough to trigger reorder suggestions without going deeply negative.
  for (const [inventoryItemId, delta] of inventoryDeltaByItem.entries()) {
    const item = inventoryItems.find((i) => i.id === inventoryItemId);
    if (!item) continue;
    const floor = Number(item.reorderThreshold) * 0.3;
    const nextStock = Math.max(floor, Number(item.currentStock) + delta);
    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { currentStock: nextStock },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Demo data complete: ${ordersCreated} orders across ${customers.length} customers over ${HISTORY_DAYS} days.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
