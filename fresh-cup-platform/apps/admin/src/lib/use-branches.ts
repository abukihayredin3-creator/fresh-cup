import type { BranchHoursDayInput, CreateBranchInput, UpdateBranchInput } from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export function useBranches() {
  return useQuery({
    queryKey: ["admin-branches-all"],
    queryFn: () => api.admin.branches.listAll(),
  });
}

export function useBranch(id: string) {
  return useQuery({
    queryKey: ["admin-branch", id],
    queryFn: () => api.admin.branches.get(id),
  });
}

export function useBranchHours(id: string) {
  return useQuery({
    queryKey: ["admin-branch-hours", id],
    queryFn: () => api.admin.branches.getHours(id),
  });
}

export function useManagers() {
  return useQuery({
    queryKey: ["admin-managers"],
    queryFn: () => api.admin.users.list({ role: "MANAGER", limit: 100 }),
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBranchInput) => api.admin.branches.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-branches-all"] });
    },
  });
}

export function useUpdateBranch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBranchInput) => api.admin.branches.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-branch", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-branches-all"] });
    },
  });
}

export function useSetBranchHours(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (days: BranchHoursDayInput[]) => api.admin.branches.setHours(id, days),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-branch-hours", id] });
    },
  });
}
