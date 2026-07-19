import { BadRequestException } from "@nestjs/common";
import {
  CampaignChannel,
  CampaignSegment,
  CampaignStatus,
  UserRole,
  type Campaign,
} from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import { CampaignsService } from "./campaigns.service";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "campaign-1",
    name: "Summer Sale",
    channel: CampaignChannel.PUSH,
    message: "20% off today!",
    targetSegment: CampaignSegment.ALL_CUSTOMERS,
    status: CampaignStatus.DRAFT,
    scheduledAt: null,
    sentAt: null,
    recipientCount: null,
    createdByUserId: "admin-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Campaign;
}

describe("CampaignsService", () => {
  let service: CampaignsService;
  let prisma: {
    campaign: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    user: { findMany: jest.Mock };
    order: { groupBy: jest.Mock };
    pushToken: { findMany: jest.Mock };
    notificationLog: { create: jest.Mock };
  };
  let smsProvider: { send: jest.Mock };
  let emailProvider: { send: jest.Mock };
  let pushProvider: { send: jest.Mock };

  const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };

  beforeEach(() => {
    prisma = {
      campaign: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      user: { findMany: jest.fn() },
      order: { groupBy: jest.fn() },
      pushToken: { findMany: jest.fn() },
      notificationLog: { create: jest.fn() },
    };
    smsProvider = { send: jest.fn().mockResolvedValue(undefined) };
    emailProvider = { send: jest.fn().mockResolvedValue(undefined) };
    pushProvider = { send: jest.fn().mockResolvedValue(undefined) };
    service = new CampaignsService(
      prisma as unknown as PrismaService,
      smsProvider,
      emailProvider,
      pushProvider,
    );
  });

  describe("create", () => {
    it("creates a DRAFT campaign when no scheduledAt is given", async () => {
      prisma.campaign.create.mockResolvedValue(makeCampaign());

      await service.create(admin, {
        name: "Summer Sale",
        channel: CampaignChannel.PUSH,
        message: "20% off today!",
      });

      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: CampaignStatus.DRAFT }),
      });
    });

    it("creates a SCHEDULED campaign when scheduledAt is given", async () => {
      prisma.campaign.create.mockResolvedValue(makeCampaign({ status: CampaignStatus.SCHEDULED }));

      await service.create(admin, {
        name: "Summer Sale",
        channel: CampaignChannel.EMAIL,
        message: "20% off today!",
        scheduledAt: "2026-08-01T00:00:00Z",
      });

      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: CampaignStatus.SCHEDULED }),
      });
    });
  });

  describe("send", () => {
    it("rejects sending an already-SENT campaign", async () => {
      prisma.campaign.findUnique.mockResolvedValue(makeCampaign({ status: CampaignStatus.SENT }));

      await expect(service.send("campaign-1")).rejects.toThrow(BadRequestException);
    });

    it("dispatches an EMAIL campaign only to recipients with an email address", async () => {
      prisma.campaign.findUnique.mockResolvedValue(
        makeCampaign({
          channel: CampaignChannel.EMAIL,
          targetSegment: CampaignSegment.ALL_CUSTOMERS,
        }),
      );
      prisma.user.findMany.mockResolvedValue([
        { id: "u1", email: "a@example.com", phone: null },
        { id: "u2", email: null, phone: "0911111111" },
      ]);
      prisma.campaign.update.mockResolvedValue(
        makeCampaign({ status: CampaignStatus.SENT, recipientCount: 1 }),
      );

      const result = await service.send("campaign-1");

      expect(emailProvider.send).toHaveBeenCalledTimes(1);
      expect(emailProvider.send).toHaveBeenCalledWith(
        "a@example.com",
        "Summer Sale",
        "20% off today!",
      );
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        data: expect.objectContaining({ status: CampaignStatus.SENT, recipientCount: 1 }),
      });
      expect(result.status).toBe(CampaignStatus.SENT);
    });

    it("resolves the VIP_CUSTOMERS segment via lifetime paid spend", async () => {
      prisma.campaign.findUnique.mockResolvedValue(
        makeCampaign({
          channel: CampaignChannel.SMS,
          targetSegment: CampaignSegment.VIP_CUSTOMERS,
        }),
      );
      prisma.order.groupBy.mockResolvedValue([
        { userId: "vip-1", _sum: { total: 600_000 } },
        { userId: "regular-1", _sum: { total: 1_000 } },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: "vip-1", email: null, phone: "0911111111" }]);
      prisma.campaign.update.mockResolvedValue(makeCampaign({ status: CampaignStatus.SENT }));

      await service.send("campaign-1");

      expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { id: { in: ["vip-1"] } } });
      expect(smsProvider.send).toHaveBeenCalledWith("0911111111", "20% off today!");
    });

    it("logs a FAILED notification and still completes when a provider throws", async () => {
      prisma.campaign.findUnique.mockResolvedValue(
        makeCampaign({ channel: CampaignChannel.EMAIL }),
      );
      prisma.user.findMany.mockResolvedValue([{ id: "u1", email: "a@example.com", phone: null }]);
      emailProvider.send.mockRejectedValue(new Error("smtp down"));
      prisma.campaign.update.mockResolvedValue(
        makeCampaign({ status: CampaignStatus.SENT, recipientCount: 0 }),
      );

      await service.send("campaign-1");

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: "FAILED" }),
      });
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        data: expect.objectContaining({ recipientCount: 0 }),
      });
    });
  });

  describe("cancel", () => {
    it("rejects cancelling a SENT campaign", async () => {
      prisma.campaign.findUnique.mockResolvedValue(makeCampaign({ status: CampaignStatus.SENT }));

      await expect(service.cancel("campaign-1")).rejects.toThrow(BadRequestException);
    });
  });
});
