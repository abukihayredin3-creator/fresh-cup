import type {
  AttachModifierGroupInput,
  BulkUpdateMenuItemsInput,
  CreateMenuCategoryInput,
  CreateMenuItemImageInput,
  CreateMenuItemInput,
  CreateModifierGroupInput,
  CreateModifierOptionInput,
  ListMenuItemsAdminParams,
  UpdateMenuCategoryInput,
  UpdateMenuItemImageInput,
  UpdateMenuItemInput,
  UpdateMenuItemModifierGroupInput,
  UpdateModifierGroupInput,
  UpdateModifierOptionInput,
} from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { PaginationParams } from "@fresh-cup/api-client";

export function useMenuCategories(branchId?: string) {
  return useQuery({
    queryKey: ["admin-menu-categories", branchId],
    queryFn: () => api.admin.menu.listCategories({ branchId, limit: 100 }),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMenuCategoryInput) => api.admin.menu.createCategory(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-categories"] }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMenuCategoryInput }) =>
      api.admin.menu.updateCategory(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-categories"] }),
  });
}

export function useRemoveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.menu.removeCategory(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-categories"] }),
  });
}

export function useMenuItems(params: PaginationParams & ListMenuItemsAdminParams) {
  return useQuery({
    queryKey: ["admin-menu-items", params],
    queryFn: () => api.admin.menu.listItems({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useMenuItem(id: string) {
  return useQuery({
    queryKey: ["admin-menu-item", id],
    queryFn: () => api.admin.menu.getItem(id),
    enabled: Boolean(id),
  });
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMenuItemInput) => api.admin.menu.createItem(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-items"] }),
  });
}

export function useUpdateMenuItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMenuItemInput) => api.admin.menu.updateItem(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-menu-item", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-menu-items"] });
    },
  });
}

export function useBulkUpdateMenuItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkUpdateMenuItemsInput) => api.admin.menu.bulkUpdateItems(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-items"] }),
  });
}

export function useSetMenuItemAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      api.admin.menu.setAvailability(id, isAvailable),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-items"] }),
  });
}

export function useRemoveMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.menu.removeItem(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-items"] }),
  });
}

export function useAddMenuItemImage(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMenuItemImageInput) => api.admin.menu.addImage(itemId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-item", itemId] }),
  });
}

export function useUpdateMenuItemImage(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ imageId, input }: { imageId: string; input: UpdateMenuItemImageInput }) =>
      api.admin.menu.updateImage(itemId, imageId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-item", itemId] }),
  });
}

export function useRemoveMenuItemImage(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => api.admin.menu.removeImage(itemId, imageId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-item", itemId] }),
  });
}

export function useAttachModifierGroup(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AttachModifierGroupInput) =>
      api.admin.menu.attachModifierGroup(itemId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-item", itemId] }),
  });
}

export function useUpdateModifierGroupLink(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, input }: { linkId: string; input: UpdateMenuItemModifierGroupInput }) =>
      api.admin.menu.updateModifierGroupLink(itemId, linkId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-item", itemId] }),
  });
}

export function useDetachModifierGroup(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => api.admin.menu.detachModifierGroup(itemId, linkId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-menu-item", itemId] }),
  });
}

export function useModifierGroups(branchId?: string) {
  return useQuery({
    queryKey: ["admin-modifier-groups", branchId],
    queryFn: () => api.admin.menu.listModifierGroups(branchId),
  });
}

export function useModifierGroup(id: string) {
  return useQuery({
    queryKey: ["admin-modifier-group", id],
    queryFn: () => api.admin.menu.getModifierGroup(id),
    enabled: Boolean(id),
  });
}

export function useCreateModifierGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateModifierGroupInput) => api.admin.menu.createModifierGroup(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-modifier-groups"] }),
  });
}

export function useUpdateModifierGroup(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateModifierGroupInput) => api.admin.menu.updateModifierGroup(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-modifier-group", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-modifier-groups"] });
    },
  });
}

export function useRemoveModifierGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.menu.removeModifierGroup(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-modifier-groups"] }),
  });
}

export function useAddModifierOption(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateModifierOptionInput) =>
      api.admin.menu.addModifierOption(groupId, input),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admin-modifier-group", groupId] }),
  });
}

export function useUpdateModifierOption(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ optionId, input }: { optionId: string; input: UpdateModifierOptionInput }) =>
      api.admin.menu.updateModifierOption(groupId, optionId, input),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admin-modifier-group", groupId] }),
  });
}

export function useRemoveModifierOption(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (optionId: string) => api.admin.menu.removeModifierOption(groupId, optionId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admin-modifier-group", groupId] }),
  });
}
