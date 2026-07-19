import type { ModifierOption } from "../catalog";

export interface CreateMenuItemInput {
  branchId: string;
  categoryId: string;
  nameEn: string;
  nameAm?: string;
  descriptionEn?: string;
  descriptionAm?: string;
  /** ETB minor units. */
  basePrice: number;
  calories?: number;
  tags?: string[];
  sortOrder?: number;
  prepTimeSeconds?: number;
  stationId?: string;
  nutrition?: Record<string, unknown>;
  isPopular?: boolean;
  isFeatured?: boolean;
  isSeasonal?: boolean;
}

export type UpdateMenuItemInput = Partial<Omit<CreateMenuItemInput, "branchId">>;

export interface CreateMenuItemImageInput {
  url: string;
  altText?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

export type UpdateMenuItemImageInput = Partial<CreateMenuItemImageInput>;

export interface CreateMenuCategoryInput {
  branchId: string;
  nameEn: string;
  nameAm?: string;
  sortOrder?: number;
}

export type UpdateMenuCategoryInput = Partial<Omit<CreateMenuCategoryInput, "branchId">> & {
  isActive?: boolean;
};

export interface CreateModifierOptionInput {
  nameEn: string;
  nameAm?: string;
  priceDelta?: number;
  sortOrder?: number;
}

export type UpdateModifierOptionInput = Partial<CreateModifierOptionInput> & { isActive?: boolean };

export interface ModifierGroupAdmin {
  id: string;
  branchId: string;
  nameEn: string;
  nameAm: string | null;
  selectionType: "SINGLE" | "MULTIPLE";
  minSelect: number;
  maxSelect: number | null;
  isActive: boolean;
  options: ModifierOption[];
}

export interface CreateModifierGroupInput {
  branchId: string;
  nameEn: string;
  nameAm?: string;
  selectionType: "SINGLE" | "MULTIPLE";
  minSelect?: number;
  maxSelect?: number;
}

export type UpdateModifierGroupInput = Partial<Omit<CreateModifierGroupInput, "branchId">> & {
  isActive?: boolean;
};

export interface AttachModifierGroupInput {
  modifierGroupId: string;
  isRequired?: boolean;
  sortOrder?: number;
}

export type UpdateMenuItemModifierGroupInput = Partial<
  Omit<AttachModifierGroupInput, "modifierGroupId">
>;

export interface BulkMenuItemPatch {
  isAvailable?: boolean;
  isPopular?: boolean;
  isFeatured?: boolean;
  isSeasonal?: boolean;
  /** ETB minor units. */
  basePrice?: number;
  categoryId?: string;
}

export interface BulkUpdateMenuItemsInput {
  menuItemIds: string[];
  patch: BulkMenuItemPatch;
}

export interface ListMenuItemsAdminParams {
  branchId?: string;
  categoryId?: string;
  isAvailable?: boolean;
  isPopular?: boolean;
  isFeatured?: boolean;
  isSeasonal?: boolean;
}
