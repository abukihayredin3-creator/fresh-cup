import type {
  AdjustGiftCardInput,
  Banner,
  Campaign,
  CampaignStatus,
  CreateBannerInput,
  CreateCampaignInput,
  CreateGiftCardInput,
  CreateReferralCodeInput,
  GiftCard,
  PaginatedResult,
  ReferralCode,
  ReferralRedemption,
  UpdateBannerInput,
  UpdateCampaignInput,
  UpdateReferralCodeInput,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminMarketingResource {
  constructor(private readonly client: ApiClient) {}

  // Banners
  listBanners(
    params: PaginationParams & { branchId?: string } = {},
  ): Promise<PaginatedResult<Banner>> {
    return this.client.request(`/admin/banners${toQueryString(params)}`);
  }

  getBanner(id: string): Promise<Banner> {
    return this.client.request(`/admin/banners/${id}`);
  }

  createBanner(input: CreateBannerInput): Promise<Banner> {
    return this.client.request("/admin/banners", { method: "POST", body: JSON.stringify(input) });
  }

  updateBanner(id: string, input: UpdateBannerInput): Promise<Banner> {
    return this.client.request(`/admin/banners/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeBanner(id: string): Promise<void> {
    return this.client.request(`/admin/banners/${id}`, { method: "DELETE" });
  }

  // Gift cards
  listGiftCards(
    params: PaginationParams & { issuedToUserId?: string } = {},
  ): Promise<PaginatedResult<GiftCard>> {
    return this.client.request(`/admin/gift-cards${toQueryString(params)}`);
  }

  getGiftCard(id: string): Promise<GiftCard> {
    return this.client.request(`/admin/gift-cards/${id}`);
  }

  createGiftCard(input: CreateGiftCardInput): Promise<GiftCard> {
    return this.client.request("/admin/gift-cards", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  adjustGiftCard(id: string, input: AdjustGiftCardInput): Promise<GiftCard> {
    return this.client.request(`/admin/gift-cards/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // Referral codes
  listReferralCodes(
    params: PaginationParams & { userId?: string } = {},
  ): Promise<PaginatedResult<ReferralCode>> {
    return this.client.request(`/admin/referral-codes${toQueryString(params)}`);
  }

  getReferralCode(id: string): Promise<ReferralCode> {
    return this.client.request(`/admin/referral-codes/${id}`);
  }

  referralRedemptions(id: string): Promise<ReferralRedemption[]> {
    return this.client.request(`/admin/referral-codes/${id}/redemptions`);
  }

  createReferralCode(input: CreateReferralCodeInput): Promise<ReferralCode> {
    return this.client.request("/admin/referral-codes", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateReferralCode(id: string, input: UpdateReferralCodeInput): Promise<ReferralCode> {
    return this.client.request(`/admin/referral-codes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  // Campaigns
  listCampaigns(
    params: PaginationParams & { status?: CampaignStatus } = {},
  ): Promise<PaginatedResult<Campaign>> {
    return this.client.request(`/admin/campaigns${toQueryString(params)}`);
  }

  getCampaign(id: string): Promise<Campaign> {
    return this.client.request(`/admin/campaigns/${id}`);
  }

  createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    return this.client.request("/admin/campaigns", { method: "POST", body: JSON.stringify(input) });
  }

  updateCampaign(id: string, input: UpdateCampaignInput): Promise<Campaign> {
    return this.client.request(`/admin/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  sendCampaign(id: string): Promise<Campaign> {
    return this.client.request(`/admin/campaigns/${id}/send`, { method: "POST" });
  }

  cancelCampaign(id: string): Promise<Campaign> {
    return this.client.request(`/admin/campaigns/${id}/cancel`, { method: "POST" });
  }
}
