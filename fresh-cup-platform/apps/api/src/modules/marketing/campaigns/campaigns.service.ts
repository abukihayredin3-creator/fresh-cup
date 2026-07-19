import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  CampaignChannel,
  CampaignSegment,
  CampaignStatus,
  NotificationChannel,
  NotificationStatus,
  OrderStatus,
  UserRole,
  type Campaign,
} from "@prisma/client";
import { SMS_PROVIDER, type SmsProvider } from "../../auth/sms/sms-provider.interface";
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from "../../notifications/providers/email-provider.interface";
import {
  PUSH_PROVIDER,
  type PushProvider,
} from "../../notifications/providers/push-provider.interface";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CampaignResponseDto } from "./dto/campaign-response.dto";
import type { CreateCampaignDto } from "./dto/create-campaign.dto";
import type { ListCampaignsQueryDto } from "./dto/list-campaigns-query.dto";
import type { UpdateCampaignDto } from "./dto/update-campaign.dto";

/** Mirrors AnalyticsService's PAID_STATUSES — the closest proxy for "counts as revenue" without joining Payment. */
const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

/** Placeholder heuristic — customers with lifetime paid spend at or above this are "VIP". */
const VIP_SPEND_THRESHOLD_MINOR_UNITS = 500_000;

const ACTIVITY_WINDOW_DAYS = 30;

const EDITABLE_STATUSES: CampaignStatus[] = [CampaignStatus.DRAFT, CampaignStatus.SCHEDULED];

/**
 * Send-side reuses the existing Phase 2 console SMS/email/push provider
 * interfaces (see NotificationsModule) — sending a campaign dispatches one
 * message per targeted user through those same providers, not a new
 * delivery pipeline. Segments are resolved at send time rather than
 * stored as a materialized recipient list.
 */
@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
  ) {}

  list(query: ListCampaignsQueryDto) {
    return paginate<Campaign>(
      (page) =>
        this.prisma.campaign.findMany({
          where: { status: query.status },
          orderBy: { createdAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    return campaign;
  }

  create(actor: RequestUser, dto: CreateCampaignDto): Promise<Campaign> {
    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        channel: dto.channel,
        message: dto.message,
        targetSegment: dto.targetSegment ?? CampaignSegment.ALL_CUSTOMERS,
        status: dto.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        createdByUserId: actor.id,
      },
    });
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.findByIdOrThrow(id);
    if (!EDITABLE_STATUSES.includes(campaign.status)) {
      throw new BadRequestException(`Cannot edit a campaign in ${campaign.status} status`);
    }
    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name,
        message: dto.message,
        targetSegment: dto.targetSegment,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        status: dto.scheduledAt ? CampaignStatus.SCHEDULED : undefined,
      },
    });
  }

  async cancel(id: string): Promise<Campaign> {
    const campaign = await this.findByIdOrThrow(id);
    if (!EDITABLE_STATUSES.includes(campaign.status)) {
      throw new BadRequestException(`Cannot cancel a campaign in ${campaign.status} status`);
    }
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELLED },
    });
  }

  private async resolveRecipients(segment: CampaignSegment) {
    if (segment === CampaignSegment.VIP_CUSTOMERS) {
      const spendByUser = await this.prisma.order.groupBy({
        by: ["userId"],
        where: { status: { in: PAID_STATUSES } },
        _sum: { total: true },
      });
      const vipUserIds = spendByUser
        .filter((row) => (row._sum.total ?? 0) >= VIP_SPEND_THRESHOLD_MINOR_UNITS)
        .map((row) => row.userId);
      return this.prisma.user.findMany({ where: { id: { in: vipUserIds } } });
    }

    if (segment === CampaignSegment.ALL_CUSTOMERS) {
      return this.prisma.user.findMany({ where: { role: UserRole.CUSTOMER } });
    }

    const cutoff = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (segment === CampaignSegment.ACTIVE_CUSTOMERS) {
      return this.prisma.user.findMany({
        where: { role: UserRole.CUSTOMER, orders: { some: { placedAt: { gte: cutoff } } } },
      });
    }
    // INACTIVE_CUSTOMERS
    return this.prisma.user.findMany({
      where: { role: UserRole.CUSTOMER, orders: { none: { placedAt: { gte: cutoff } } } },
    });
  }

  /** Dispatches the campaign message to every user in its target segment via the matching channel provider. */
  async send(id: string): Promise<Campaign> {
    const campaign = await this.findByIdOrThrow(id);
    if (!EDITABLE_STATUSES.includes(campaign.status)) {
      throw new BadRequestException(`Cannot send a campaign in ${campaign.status} status`);
    }

    const recipients = await this.resolveRecipients(campaign.targetSegment);
    let sentCount = 0;

    for (const user of recipients) {
      const dispatched = await this.dispatchToUser(campaign, user.id, user.email, user.phone);
      if (dispatched) {
        sentCount += 1;
      }
    }

    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.SENT, sentAt: new Date(), recipientCount: sentCount },
    });
  }

  private async dispatchToUser(
    campaign: Campaign,
    userId: string,
    email: string | null,
    phone: string | null,
  ): Promise<boolean> {
    if (campaign.channel === CampaignChannel.EMAIL) {
      if (!email) return false;
      return this.dispatch(userId, NotificationChannel.EMAIL, campaign.id, () =>
        this.emailProvider.send(email, campaign.name, campaign.message),
      );
    }
    if (campaign.channel === CampaignChannel.SMS) {
      if (!phone) return false;
      return this.dispatch(userId, NotificationChannel.SMS, campaign.id, () =>
        this.smsProvider.send(phone, campaign.message),
      );
    }
    // PUSH
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return false;
    let anySent = false;
    for (const token of tokens) {
      const sent = await this.dispatch(userId, NotificationChannel.PUSH, campaign.id, () =>
        this.pushProvider.send(token.token, campaign.name, campaign.message),
      );
      anySent = anySent || sent;
    }
    return anySent;
  }

  private async dispatch(
    userId: string,
    channel: NotificationChannel,
    campaignId: string,
    send: () => Promise<void>,
  ): Promise<boolean> {
    const payload = { campaignId };
    try {
      await send();
      await this.prisma.notificationLog.create({
        data: {
          userId,
          channel,
          type: "marketing_campaign",
          payload,
          status: NotificationStatus.SENT,
        },
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send campaign ${campaignId} via ${channel} to user ${userId}: ${message}`,
      );
      await this.prisma.notificationLog.create({
        data: {
          userId,
          channel,
          type: "marketing_campaign",
          payload,
          status: NotificationStatus.FAILED,
          error: message,
        },
      });
      return false;
    }
  }

  toResponse(campaign: Campaign): CampaignResponseDto {
    return {
      id: campaign.id,
      name: campaign.name,
      channel: campaign.channel,
      message: campaign.message,
      targetSegment: campaign.targetSegment,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      sentAt: campaign.sentAt,
      recipientCount: campaign.recipientCount,
      createdAt: campaign.createdAt,
    };
  }
}
