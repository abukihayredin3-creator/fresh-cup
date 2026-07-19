import type { UpdateSettingsInput } from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export function useSettings() {
  return useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api.admin.settings.get(),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => api.admin.settings.update(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
  });
}
