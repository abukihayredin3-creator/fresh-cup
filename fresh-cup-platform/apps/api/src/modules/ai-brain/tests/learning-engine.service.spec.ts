import { NotFoundException } from "@nestjs/common";
import { AiRecommendationStatus } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import { LearningEngineService } from "../services/learning-engine.service";

describe("LearningEngineService", () => {
  let service: LearningEngineService;
  let prisma: {
    aiRecommendation: { findFirst: jest.Mock; update: jest.Mock };
    aiLearningEvent: { create: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      aiRecommendation: {
        findFirst: jest.fn().mockResolvedValue({ id: "rec-1" }),
        update: jest.fn(),
      },
      aiLearningEvent: {
        create: jest.fn().mockResolvedValue({ id: "event-1" }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new LearningEngineService(prisma as unknown as PrismaService);
  });

  describe("recordFeedback", () => {
    it("rejects feedback for a recommendation outside the organization", async () => {
      prisma.aiRecommendation.findFirst.mockResolvedValue(null);

      await expect(
        service.recordFeedback("org-1", {
          recommendationId: "rec-1",
          result: "ACCEPTED",
          feedback: {},
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.aiLearningEvent.create).not.toHaveBeenCalled();
    });

    it("scopes the recommendation lookup to the organization", async () => {
      await service.recordFeedback("org-1", {
        recommendationId: "rec-1",
        result: "some free-form note",
        feedback: { note: "worked well" },
      });

      expect(prisma.aiRecommendation.findFirst).toHaveBeenCalledWith({
        where: { id: "rec-1", organizationId: "org-1" },
        select: { id: true },
      });
    });

    it("records a free-form result without moving the recommendation's status", async () => {
      await service.recordFeedback("org-1", {
        recommendationId: "rec-1",
        result: "revenue increased 5% the following week",
        feedback: { revenueDeltaPct: 5 },
      });

      expect(prisma.aiLearningEvent.create).toHaveBeenCalledWith({
        data: {
          recommendationId: "rec-1",
          result: "revenue increased 5% the following week",
          feedback: { revenueDeltaPct: 5 },
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.aiRecommendation.update).not.toHaveBeenCalled();
    });

    it("advances the recommendation status when the result names a lifecycle transition", async () => {
      await service.recordFeedback("org-1", {
        recommendationId: "rec-1",
        result: "accepted",
        feedback: {},
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.aiRecommendation.update).toHaveBeenCalledWith({
        where: { id: "rec-1" },
        data: { status: AiRecommendationStatus.ACCEPTED },
      });
    });

    it("recognizes REJECTED and IMPLEMENTED transitions case-insensitively", async () => {
      await service.recordFeedback("org-1", {
        recommendationId: "rec-1",
        result: "rejected",
        feedback: {},
      });
      expect(prisma.aiRecommendation.update).toHaveBeenCalledWith({
        where: { id: "rec-1" },
        data: { status: AiRecommendationStatus.REJECTED },
      });

      await service.recordFeedback("org-1", {
        recommendationId: "rec-1",
        result: "Implemented",
        feedback: {},
      });
      expect(prisma.aiRecommendation.update).toHaveBeenCalledWith({
        where: { id: "rec-1" },
        data: { status: AiRecommendationStatus.IMPLEMENTED },
      });
    });
  });

  describe("outcomesFor", () => {
    it("throws when the recommendation does not belong to the organization", async () => {
      prisma.aiRecommendation.findFirst.mockResolvedValue(null);

      await expect(service.outcomesFor("org-1", "rec-1")).rejects.toThrow(NotFoundException);
    });

    it("returns learning events ordered by recency", async () => {
      await service.outcomesFor("org-1", "rec-1");

      expect(prisma.aiLearningEvent.findMany).toHaveBeenCalledWith({
        where: { recommendationId: "rec-1" },
        orderBy: { createdAt: "desc" },
      });
    });
  });
});
