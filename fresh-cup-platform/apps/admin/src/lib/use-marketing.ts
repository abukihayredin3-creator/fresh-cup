import type {
  AdjustGiftCardInput,
  CampaignStatus,
  CreateBannerInput,
  CreateCampaignInput,
  CreateGiftCardInput,
  CreateReferralCodeInput,
  UpdateBannerInput,
  UpdateCampaignInput,
  UpdateReferralCodeInput,
} from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { PaginationParams } from "@fresh-cup/api-client";

export function useBanners(params: PaginationParams & { branchId?: string }) {
  return useQuery({
    queryKey: ["admin-banners", params],
    queryFn: () => api.admin.marketing.listBanners({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useCreateBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBannerInput) => api.admin.marketing.createBanner(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-banners"] }),
  });
}

export function useUpdateBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBannerInput }) =>
      api.admin.marketing.updateBanner(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-banners"] }),
  });
}

export function useRemoveBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.marketing.removeBanner(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-banners"] }),
  });
}

export function useGiftCards(params: PaginationParams & { issuedToUserId?: string }) {
  return useQuery({
    queryKey: ["admin-gift-cards", params],
    queryFn: () => api.admin.marketing.listGiftCards({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useCreateGiftCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGiftCardInput) => api.admin.marketing.createGiftCard(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-gift-cards"] }),
  });
}

export function useAdjustGiftCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdjustGiftCardInput }) =>
      api.admin.marketing.adjustGiftCard(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-gift-cards"] }),
  });
}

export function useReferralCodes(params: PaginationParams & { userId?: string }) {
  return useQuery({
    queryKey: ["admin-referral-codes", params],
    queryFn: () => api.admin.marketing.listReferralCodes({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useReferralRedemptions(id: string) {
  return useQuery({
    queryKey: ["admin-referral-redemptions", id],
    queryFn: () => api.admin.marketing.referralRedemptions(id),
    enabled: Boolean(id),
  });
}

export function useCreateReferralCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReferralCodeInput) => api.admin.marketing.createReferralCode(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-referral-codes"] }),
  });
}

export function useUpdateReferralCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReferralCodeInput }) =>
      api.admin.marketing.updateReferralCode(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-referral-codes"] }),
  });
}

export function useCampaigns(params: PaginationParams & { status?: CampaignStatus }) {
  return useQuery({
    queryKey: ["admin-campaigns", params],
    queryFn: () => api.admin.marketing.listCampaigns({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) => api.admin.marketing.createCampaign(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] }),
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCampaignInput }) =>
      api.admin.marketing.updateCampaign(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] }),
  });
}

export function useSendCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.marketing.sendCampaign(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] }),
  });
}

export function useCancelCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.marketing.cancelCampaign(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] }),
  });
}
