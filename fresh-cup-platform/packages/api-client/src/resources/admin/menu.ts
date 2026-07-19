import type {
  AttachModifierGroupInput,
  BulkUpdateMenuItemsInput,
  CreateMenuCategoryInput,
  CreateMenuItemImageInput,
  CreateMenuItemInput,
  CreateModifierGroupInput,
  CreateModifierOptionInput,
  ListMenuItemsAdminParams,
  MenuCategory,
  MenuItem,
  MenuItemImage,
  ModifierGroupAdmin,
  ModifierOption,
  PaginatedResult,
  UpdateMenuCategoryInput,
  UpdateMenuItemImageInput,
  UpdateMenuItemInput,
  UpdateMenuItemModifierGroupInput,
  UpdateModifierGroupInput,
  UpdateModifierOptionInput,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminMenuResource {
  constructor(private readonly client: ApiClient) {}

  // Categories
  listCategories(): Promise<PaginatedResult<MenuCategory>> {
    return this.client.request("/admin/menu-categories");
  }

  createCategory(input: CreateMenuCategoryInput): Promise<MenuCategory> {
    return this.client.request("/admin/menu-categories", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateCategory(id: string, input: UpdateMenuCategoryInput): Promise<MenuCategory> {
    return this.client.request(`/admin/menu-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeCategory(id: string): Promise<void> {
    return this.client.request(`/admin/menu-categories/${id}`, { method: "DELETE" });
  }

  // Items
  listItems(
    params: PaginationParams & ListMenuItemsAdminParams = {},
  ): Promise<PaginatedResult<MenuItem>> {
    return this.client.request(`/admin/menu-items${toQueryString(params)}`);
  }

  getItem(id: string): Promise<MenuItem> {
    return this.client.request(`/admin/menu-items/${id}`);
  }

  createItem(input: CreateMenuItemInput): Promise<MenuItem> {
    return this.client.request("/admin/menu-items", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateItem(id: string, input: UpdateMenuItemInput): Promise<MenuItem> {
    return this.client.request(`/admin/menu-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  bulkUpdateItems(input: BulkUpdateMenuItemsInput): Promise<{ updatedCount: number }> {
    return this.client.request("/admin/menu-items/bulk", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  setAvailability(id: string, isAvailable: boolean): Promise<MenuItem> {
    return this.client.request(`/admin/menu-items/${id}/availability`, {
      method: "PATCH",
      body: JSON.stringify({ isAvailable }),
    });
  }

  removeItem(id: string): Promise<void> {
    return this.client.request(`/admin/menu-items/${id}`, { method: "DELETE" });
  }

  // Images
  addImage(itemId: string, input: CreateMenuItemImageInput): Promise<MenuItemImage> {
    return this.client.request(`/admin/menu-items/${itemId}/images`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateImage(
    itemId: string,
    imageId: string,
    input: UpdateMenuItemImageInput,
  ): Promise<MenuItemImage> {
    return this.client.request(`/admin/menu-items/${itemId}/images/${imageId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeImage(itemId: string, imageId: string): Promise<void> {
    return this.client.request(`/admin/menu-items/${itemId}/images/${imageId}`, {
      method: "DELETE",
    });
  }

  // Modifier group <-> menu item attachment
  attachModifierGroup(itemId: string, input: AttachModifierGroupInput) {
    return this.client.request(`/admin/menu-items/${itemId}/modifier-groups`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateModifierGroupLink(itemId: string, linkId: string, input: UpdateMenuItemModifierGroupInput) {
    return this.client.request(`/admin/menu-items/${itemId}/modifier-groups/${linkId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  detachModifierGroup(itemId: string, linkId: string): Promise<void> {
    return this.client.request(`/admin/menu-items/${itemId}/modifier-groups/${linkId}`, {
      method: "DELETE",
    });
  }

  // Modifier groups (standalone CRUD)
  listModifierGroups(branchId?: string): Promise<PaginatedResult<ModifierGroupAdmin>> {
    return this.client.request(`/admin/modifier-groups${toQueryString({ branchId })}`);
  }

  getModifierGroup(id: string): Promise<ModifierGroupAdmin> {
    return this.client.request(`/admin/modifier-groups/${id}`);
  }

  createModifierGroup(input: CreateModifierGroupInput): Promise<ModifierGroupAdmin> {
    return this.client.request("/admin/modifier-groups", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateModifierGroup(id: string, input: UpdateModifierGroupInput): Promise<ModifierGroupAdmin> {
    return this.client.request(`/admin/modifier-groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeModifierGroup(id: string): Promise<void> {
    return this.client.request(`/admin/modifier-groups/${id}`, { method: "DELETE" });
  }

  addModifierOption(groupId: string, input: CreateModifierOptionInput): Promise<ModifierOption> {
    return this.client.request(`/admin/modifier-groups/${groupId}/options`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateModifierOption(
    groupId: string,
    optionId: string,
    input: UpdateModifierOptionInput,
  ): Promise<ModifierOption> {
    return this.client.request(`/admin/modifier-groups/${groupId}/options/${optionId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeModifierOption(groupId: string, optionId: string): Promise<void> {
    return this.client.request(`/admin/modifier-groups/${groupId}/options/${optionId}`, {
      method: "DELETE",
    });
  }
}
