import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export function useMySessions() {
  return useQuery({
    queryKey: ["security-my-sessions"],
    queryFn: () => api.security.listMySessions(),
  });
}

export function useRevokeMySession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.security.revokeMySession(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["security-my-sessions"] }),
  });
}

export function useRevokeAllUserSessions() {
  return useMutation({
    mutationFn: (userId: string) => api.security.revokeAllUserSessions(userId),
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: ["security-api-keys"],
    queryFn: () => api.security.listApiKeys(),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.security.createApiKey(name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["security-api-keys"] }),
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.security.revokeApiKey(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["security-api-keys"] }),
  });
}

export function useTwoFactorStatus() {
  return useQuery({
    queryKey: ["security-2fa-status"],
    queryFn: () => api.security.twoFactorStatus(),
  });
}

export function useEnrollTwoFactor() {
  return useMutation({
    mutationFn: () => api.security.enrollTwoFactor(),
  });
}

export function useVerifyTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.security.verifyTwoFactor(code),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["security-2fa-status"] }),
  });
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.security.disableTwoFactor(code),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["security-2fa-status"] }),
  });
}
