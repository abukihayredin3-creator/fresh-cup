import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { OrganizationSubscription, SubscriptionPlan } from "@prisma/client";
import { SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { CreateSubscriptionPlanDto } from "./dto/create-subscription-plan.dto";
import type { SubscribeDto } from "./dto/subscribe.dto";

const TRIAL_DAYS = 14;
const BILLING_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SeatLimitCheck {
  used: number;
  seats: number;
  withinLimit: boolean;
}

/**
 * Plans and subscriptions. `isEntitled()` is the enforcement point a
 * feature-gated endpoint elsewhere in the platform would call before
 * doing enterprise-only work — no subscription (an org that hasn't
 * onboarded a plan yet) resolves every entitlement to `false`, fail
 * closed rather than assuming a default plan's features.
 */
@Injectable()
export class LicensingService {
  constructor(private readonly prisma: PrismaService) {}

  listPlans(): Promise<SubscriptionPlan[]> {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { priceMonthlyMinor: "asc" } });
  }

  async createPlan(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { key: dto.key } });
    if (existing) {
      throw new ConflictException(`Plan '${dto.key}' already exists`);
    }
    return this.prisma.subscriptionPlan.create({ data: dto });
  }

  getSubscription(organizationId: string): Promise<OrganizationSubscription | null> {
    return this.prisma.organizationSubscription.findUnique({ where: { organizationId } });
  }

  /** Starts (or replaces) an organization's subscription in TRIALING status. */
  async subscribe(organizationId: string, dto: SubscribeDto): Promise<OrganizationSubscription> {
    const plan = await this.findPlanOrThrow(dto.planKey);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);
    return this.prisma.organizationSubscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId: plan.id,
        status: SubscriptionStatus.TRIALING,
        seats: dto.seats ?? 1,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
      },
      update: {
        planId: plan.id,
        seats: dto.seats ?? 1,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + BILLING_PERIOD_DAYS * DAY_MS),
        cancelledAt: null,
      },
    });
  }

  async cancel(organizationId: string): Promise<OrganizationSubscription> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new NotFoundException("No subscription to cancel");
    }
    return this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  async isEntitled(organizationId: string, featureKey: string): Promise<boolean> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (!subscription || subscription.status === SubscriptionStatus.CANCELLED) {
      return false;
    }
    const features = subscription.plan.features;
    return Array.isArray(features) && features.includes(featureKey);
  }

  async checkSeatLimit(organizationId: string): Promise<SeatLimitCheck> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    const seats = subscription?.seats ?? 0;
    const used = await this.prisma.user.count({
      where: { branch: { organizationId }, isActive: true },
    });
    return { used, seats, withinLimit: used <= seats };
  }

  private async findPlanOrThrow(key: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { key } });
    if (!plan) {
      throw new NotFoundException(`Plan '${key}' not found`);
    }
    return plan;
  }
}
