import { BadRequestException } from "@nestjs/common";
import { ModifierSelectionType } from "@prisma/client";
import type { MenuItemDetail } from "../../catalog/menu-items/menu-items.service";
import type { MenuItemsService } from "../../catalog/menu-items/menu-items.service";
import type { PrismaService } from "../../../database/prisma.service";
import { CartService } from "./cart.service";

function buildMenuItem(overrides: Partial<MenuItemDetail> = {}): MenuItemDetail {
  return {
    id: "item-1",
    branchId: "branch-1",
    categoryId: "cat-1",
    nameEn: "Berry Boost",
    nameAm: null,
    descriptionEn: null,
    descriptionAm: null,
    basePrice: 10000,
    isAvailable: true,
    calories: null,
    tags: [],
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    images: [],
    modifierGroupLinks: [
      {
        id: "link-size",
        menuItemId: "item-1",
        modifierGroupId: "group-size",
        isRequired: true,
        sortOrder: 0,
        createdAt: new Date(),
        modifierGroup: {
          id: "group-size",
          branchId: "branch-1",
          nameEn: "Size",
          nameAm: null,
          selectionType: ModifierSelectionType.SINGLE,
          minSelect: 1,
          maxSelect: 1,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          options: [
            {
              id: "opt-small",
              modifierGroupId: "group-size",
              nameEn: "Small",
              nameAm: null,
              priceDelta: 0,
              isActive: true,
              sortOrder: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: "opt-large",
              modifierGroupId: "group-size",
              nameEn: "Large",
              nameAm: null,
              priceDelta: 2000,
              isActive: true,
              sortOrder: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      },
      {
        id: "link-addons",
        menuItemId: "item-1",
        modifierGroupId: "group-addons",
        isRequired: false,
        sortOrder: 1,
        createdAt: new Date(),
        modifierGroup: {
          id: "group-addons",
          branchId: "branch-1",
          nameEn: "Add-ons",
          nameAm: null,
          selectionType: ModifierSelectionType.MULTIPLE,
          minSelect: 0,
          maxSelect: 2,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          options: [
            {
              id: "opt-chia",
              modifierGroupId: "group-addons",
              nameEn: "Chia Seeds",
              nameAm: null,
              priceDelta: 500,
              isActive: true,
              sortOrder: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: "opt-honey",
              modifierGroupId: "group-addons",
              nameEn: "Extra Honey",
              nameAm: null,
              priceDelta: 300,
              isActive: true,
              sortOrder: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      },
    ],
    ...overrides,
  } as MenuItemDetail;
}

describe("CartService.validateModifierSelection", () => {
  let service: CartService;

  beforeEach(() => {
    service = new CartService({} as unknown as PrismaService, {} as unknown as MenuItemsService);
  });

  it("accepts a valid required Size + optional Add-on selection", () => {
    const selections = service.validateModifierSelection(buildMenuItem(), [
      "opt-small",
      "opt-chia",
    ]);
    expect(selections).toEqual([
      { modifierOptionId: "opt-small", nameEn: "Small", priceDelta: 0 },
      { modifierOptionId: "opt-chia", nameEn: "Chia Seeds", priceDelta: 500 },
    ]);
  });

  it("rejects an option that doesn't belong to any group attached to the item", () => {
    expect(() => service.validateModifierSelection(buildMenuItem(), ["opt-unknown"])).toThrow(
      BadRequestException,
    );
  });

  it("rejects omitting a required group's selection", () => {
    expect(() => service.validateModifierSelection(buildMenuItem(), [])).toThrow(
      BadRequestException,
    );
  });

  it("rejects selecting more than one option from a SINGLE-selection group", () => {
    expect(() =>
      service.validateModifierSelection(buildMenuItem(), ["opt-small", "opt-large"]),
    ).toThrow(BadRequestException);
  });

  it("rejects exceeding a MULTIPLE group's maxSelect", () => {
    const menuItem = buildMenuItem();
    // Add-ons group only has 2 options and maxSelect is 2, so this alone is valid;
    // widen it to prove the cap is enforced once a third real option exists.
    menuItem.modifierGroupLinks[1]!.modifierGroup.maxSelect = 1;
    expect(() =>
      service.validateModifierSelection(menuItem, ["opt-small", "opt-chia", "opt-honey"]),
    ).toThrow(BadRequestException);
  });

  it("allows an optional group to be skipped entirely", () => {
    const selections = service.validateModifierSelection(buildMenuItem(), ["opt-small"]);
    expect(selections).toEqual([{ modifierOptionId: "opt-small", nameEn: "Small", priceDelta: 0 }]);
  });
});
