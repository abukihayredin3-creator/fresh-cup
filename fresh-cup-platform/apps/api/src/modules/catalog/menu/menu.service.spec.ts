import { NotFoundException } from "@nestjs/common";
import type { Branch, MenuCategory } from "@prisma/client";
import type { BranchesService } from "../../branches/branches.service";
import type { MenuCategoriesService } from "../categories/menu-categories.service";
import type { MenuItemDetail } from "../menu-items/menu-items.service";
import { MenuItemsService } from "../menu-items/menu-items.service";
import { MenuService } from "./menu.service";

function branch(id: string): Branch {
  return {
    id,
    organizationId: "org-1",
    name: `Branch ${id}`,
    addressText: "123 Test Street",
    latitude: null,
    longitude: null,
    phone: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Branch;
}

function category(id: string, branchId: string): MenuCategory {
  return {
    id,
    branchId,
    nameEn: `Category ${id}`,
    nameAm: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as MenuCategory;
}

function itemDetail(id: string, branchId: string, isAvailable = true): MenuItemDetail {
  return {
    id,
    branchId,
    categoryId: "cat-1",
    nameEn: `Item ${id}`,
    nameAm: null,
    descriptionEn: null,
    descriptionAm: null,
    basePrice: 5000,
    isAvailable,
    calories: null,
    tags: [],
    sortOrder: 0,
    prepTimeSeconds: null,
    stationId: null,
    nutrition: null,
    isPopular: false,
    isFeatured: false,
    isSeasonal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    images: [],
    modifierGroupLinks: [],
  } as unknown as MenuItemDetail;
}

describe("MenuService", () => {
  let service: MenuService;
  let branches: { findByIdOrThrow: jest.Mock; listActive: jest.Mock };
  let categories: { listActiveForBranch: jest.Mock; toResponse: jest.Mock };
  let menuItems: {
    listAvailableForBranch: jest.Mock;
    findByIdOrThrow: jest.Mock;
    toResponse: jest.Mock;
  };

  beforeEach(() => {
    branches = {
      findByIdOrThrow: jest.fn(),
      listActive: jest.fn().mockResolvedValue([branch("branch-1"), branch("branch-2")]),
    };
    categories = {
      listActiveForBranch: jest.fn().mockResolvedValue([category("cat-1", "branch-1")]),
      toResponse: jest.fn((c: MenuCategory) => ({ id: c.id, branchId: c.branchId })),
    };
    menuItems = {
      listAvailableForBranch: jest
        .fn()
        .mockResolvedValue({ items: [itemDetail("item-1", "branch-1")], nextCursor: null }),
      findByIdOrThrow: jest.fn(),
      toResponse: jest.fn((i: MenuItemDetail) => ({ id: i.id, branchId: i.branchId })),
    };

    service = new MenuService(
      branches as unknown as BranchesService,
      categories as unknown as MenuCategoriesService,
      menuItems as unknown as MenuItemsService,
    );
  });

  describe("browse", () => {
    it("defaults to the platform's first active branch when no branchId is given", async () => {
      const result = await service.browse();

      expect(branches.listActive).toHaveBeenCalled();
      expect(branches.findByIdOrThrow).not.toHaveBeenCalled();
      expect(result.branchId).toBe("branch-1");
      expect(result.categories).toEqual([{ id: "cat-1", branchId: "branch-1" }]);
      expect(result.items).toEqual([{ id: "item-1", branchId: "branch-1" }]);
      expect(menuItems.listAvailableForBranch).toHaveBeenCalledWith(
        "branch-1",
        expect.objectContaining({ limit: 100 }),
      );
    });

    it("uses the requested branch when branchId is given, after verifying it exists", async () => {
      branches.findByIdOrThrow.mockResolvedValue(branch("branch-2"));

      const result = await service.browse("branch-2");

      expect(branches.findByIdOrThrow).toHaveBeenCalledWith("branch-2");
      expect(branches.listActive).not.toHaveBeenCalled();
      expect(menuItems.listAvailableForBranch).toHaveBeenCalledWith(
        "branch-2",
        expect.objectContaining({ limit: 100 }),
      );
      expect(result.branchId).toBe("branch-2");
    });

    it("propagates a 404 for a branchId that doesn't exist", async () => {
      branches.findByIdOrThrow.mockRejectedValue(new NotFoundException("Branch not found"));

      await expect(service.browse("missing-branch")).rejects.toThrow(NotFoundException);
    });

    it("returns an empty menu when no active branch exists and none was requested", async () => {
      branches.listActive.mockResolvedValue([]);

      const result = await service.browse();

      expect(result).toEqual({ branchId: null, categories: [], items: [] });
      expect(categories.listActiveForBranch).not.toHaveBeenCalled();
      expect(menuItems.listAvailableForBranch).not.toHaveBeenCalled();
    });
  });

  describe("listCategories", () => {
    it("lists categories for the default branch when none is given", async () => {
      const result = await service.listCategories();

      expect(result).toEqual([{ id: "cat-1", branchId: "branch-1" }]);
    });

    it("returns an empty array when no active branch exists", async () => {
      branches.listActive.mockResolvedValue([]);

      const result = await service.listCategories();

      expect(result).toEqual([]);
    });
  });

  describe("getItem", () => {
    it("returns an available item regardless of branch", async () => {
      menuItems.findByIdOrThrow.mockResolvedValue(itemDetail("item-9", "branch-2"));

      const result = await service.getItem("item-9");

      expect(result).toEqual({ id: "item-9", branchId: "branch-2" });
    });

    it("404s for an unavailable item", async () => {
      menuItems.findByIdOrThrow.mockResolvedValue(itemDetail("item-9", "branch-2", false));

      await expect(service.getItem("item-9")).rejects.toThrow(NotFoundException);
    });

    it("propagates the not-found error for a missing item id", async () => {
      menuItems.findByIdOrThrow.mockRejectedValue(new NotFoundException("Menu item not found"));

      await expect(service.getItem("missing")).rejects.toThrow(NotFoundException);
    });
  });
});
