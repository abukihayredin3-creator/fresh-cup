import { ShiftStatus } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import type { ExplanationService } from "../explanation.service";
import { WorkforceAiService } from "./workforce-ai.service";

function makeService(overrides: {
  orders?: { placedAt: Date }[];
  shifts?: {
    userId?: string;
    startsAt: Date;
    endsAt: Date;
    status?: ShiftStatus;
    user?: { fullName: string };
  }[];
  attendances?: { userId: string; clockInAt: Date }[];
  performanceNotes?: {
    userId: string;
    rating: number;
    createdAt: Date;
    user: { fullName: string };
  }[];
}) {
  const prisma = {
    order: { findMany: jest.fn().mockResolvedValue(overrides.orders ?? []) },
    shift: { findMany: jest.fn().mockResolvedValue(overrides.shifts ?? []) },
    attendance: { findMany: jest.fn().mockResolvedValue(overrides.attendances ?? []) },
    performanceNote: { findMany: jest.fn().mockResolvedValue(overrides.performanceNotes ?? []) },
  } as unknown as jest.Mocked<PrismaService>;
  const explanation = {
    explain: jest
      .fn()
      .mockImplementation((topic: string) => Promise.resolve(`Explained: ${topic}`)),
  } as unknown as jest.Mocked<ExplanationService>;
  const service = new WorkforceAiService(prisma, explanation);
  return { service, prisma };
}

describe("WorkforceAiService", () => {
  it("flags understaffed hours where order volume greatly outpaces scheduled coverage", async () => {
    const day = (h: number) => new Date(2026, 5, 15, h, 0, 0);
    const orders = [
      ...Array.from({ length: 20 }, () => ({ placedAt: day(12) })),
      { placedAt: day(9) },
      { placedAt: day(15) },
      { placedAt: day(18) },
    ];
    const shifts = [
      { startsAt: day(9), endsAt: day(10) },
      { startsAt: day(12), endsAt: day(13) },
      { startsAt: day(15), endsAt: day(16) },
      { startsAt: day(18), endsAt: day(19) },
    ];
    const { service } = makeService({ orders, shifts });

    const results = await service.schedulingInsights();
    expect(results.some((r) => r.title.includes("understaffed"))).toBe(true);
  });

  it("flags a no-show when a shift has no same-day attendance record", async () => {
    const shiftStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const { service } = makeService({
      shifts: [
        {
          userId: "user-1",
          startsAt: shiftStart,
          endsAt: new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000),
          status: ShiftStatus.SCHEDULED,
          user: { fullName: "Selam" },
        } as never,
      ],
      attendances: [],
    });

    const results = await service.attendanceAnomalies();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("No-show: Selam");
  });

  it("flags a late clock-in beyond the 15-minute threshold", async () => {
    const shiftStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const { service } = makeService({
      shifts: [
        {
          userId: "user-1",
          startsAt: shiftStart,
          endsAt: new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000),
          status: ShiftStatus.SCHEDULED,
          user: { fullName: "Selam" },
        } as never,
      ],
      attendances: [
        { userId: "user-1", clockInAt: new Date(shiftStart.getTime() + 30 * 60 * 1000) },
      ],
    });

    const results = await service.attendanceAnomalies();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Late clock-in: Selam");
  });

  it("does not flag an on-time clock-in", async () => {
    const shiftStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const { service } = makeService({
      shifts: [
        {
          userId: "user-1",
          startsAt: shiftStart,
          endsAt: new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000),
          status: ShiftStatus.SCHEDULED,
          user: { fullName: "Selam" },
        } as never,
      ],
      attendances: [
        { userId: "user-1", clockInAt: new Date(shiftStart.getTime() + 5 * 60 * 1000) },
      ],
    });

    const results = await service.attendanceAnomalies();
    expect(results).toHaveLength(0);
  });

  it("computes an improving performance trend when recent ratings beat prior ratings", async () => {
    const now = Date.now();
    const { service } = makeService({
      performanceNotes: [
        {
          userId: "u1",
          rating: 3,
          createdAt: new Date(now - 45 * 24 * 60 * 60 * 1000),
          user: { fullName: "Dawit" },
        },
        {
          userId: "u1",
          rating: 5,
          createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
          user: { fullName: "Dawit" },
        },
      ],
    });

    const results = await service.performanceTrends();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toContain("improving");
  });

  it("computes labor coverage efficiency as orders per scheduled hour", async () => {
    const day = (h: number) => new Date(2026, 5, 15, h, 0, 0);
    const { service } = makeService({
      orders: Array.from({ length: 10 }, () => ({ placedAt: day(12) })),
      shifts: [{ startsAt: day(9), endsAt: day(14) }], // 5 scheduled hours
    });

    const results = await service.laborCostOptimization();
    expect(results).toHaveLength(1);
    const data = results[0]!.data as { ordersPerLaborHour: number };
    expect(data.ordersPerLaborHour).toBe(2);
  });

  it("returns no labor coverage insight when there are no scheduled hours", async () => {
    const { service } = makeService({});
    const results = await service.laborCostOptimization();
    expect(results).toHaveLength(0);
  });
});
