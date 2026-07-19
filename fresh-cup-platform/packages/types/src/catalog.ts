import type { ModifierSelectionType } from "./enums";

export interface MenuCategory {
  id: string;
  branchId: string;
  nameEn: string;
  nameAm: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItemImage {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ModifierOption {
  id: string;
  nameEn: string;
  nameAm: string | null;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
}

/** The shape a menu item embeds — how it can be customized at checkout. */
export interface MenuItemModifierGroup {
  id: string;
  modifierGroupId: string;
  nameEn: string;
  nameAm: string | null;
  selectionType: ModifierSelectionType;
  minSelect: number;
  maxSelect: number | null;
  isRequired: boolean;
  sortOrder: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  branchId: string;
  categoryId: string;
  nameEn: string;
  nameAm: string | null;
  descriptionEn: string | null;
  descriptionAm: string | null;
  /** ETB minor units. */
  basePrice: number;
  isAvailable: boolean;
  calories: number | null;
  tags: string[];
  sortOrder: number;
  prepTimeSeconds: number;
  stationId: string | null;
  images: MenuItemImage[];
  modifierGroups: MenuItemModifierGroup[];
}
