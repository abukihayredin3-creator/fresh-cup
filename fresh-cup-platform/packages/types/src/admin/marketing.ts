import type { CampaignChannel, CampaignSegment, CampaignStatus } from "../enums";

export interface Banner {
  id: string;
  branchId: string | null;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateBannerInput {
  branchId?: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  startsAt?: string;
  endsAt?: string;
  sortOrder?: number;
}

export type UpdateBannerInput = Partial<CreateBannerInput> & { isActive?: boolean };

export interface GiftCard {
  id: string;
  code: string;
  initialBalance: number;
  currentBalance: number;
  issuedToUserId: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateGiftCardInput {
  initialBalance: number;
  issuedToUserId?: string;
  expiresAt?: string;
}

export interface AdjustGiftCardInput {
  amount: number;
  orderId?: string;
  note?: string;
}

export interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  rewardAmount: number;
  usesCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateReferralCodeInput {
  userId: string;
  rewardAmount: number;
}

export interface UpdateReferralCodeInput {
  rewardAmount?: number;
  isActive?: boolean;
}

export interface ReferralRedemption {
  id: string;
  referralCodeId: string;
  referredUserId: string;
  orderId: string | null;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  message: string;
  targetSegment: CampaignSegment;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number | null;
  createdAt: string;
}

export interface CreateCampaignInput {
  name: string;
  channel: CampaignChannel;
  message: string;
  targetSegment?: CampaignSegment;
  scheduledAt?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  message?: string;
  targetSegment?: CampaignSegment;
  scheduledAt?: string;
}
