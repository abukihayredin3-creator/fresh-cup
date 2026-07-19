/**
 * Seeds one branch, a starter menu (categories + products + images), a
 * handful of inventory items, Phase 2 ordering fixtures (modifiers, a
 * dine-in table, a coupon) so every endpoint has real data to browse in
 * development. Idempotent — safe to re-run. Cart/order/payment rows are
 * deliberately not seeded — they're transactional data, not fixtures.
 *
 * Admin/manager/staff dev accounts are only created when NODE_ENV is not
 * "production" AND the corresponding *_SEED_EMAIL/_SEED_PASSWORD env vars
 * are set — never accidentally in a real environment.
 */
import {
  PrismaClient,
  InventoryUnit,
  UserRole,
  ModifierSelectionType,
  DiscountType,
} from "@prisma/client";
import { hashPassword } from "../src/common/crypto/password.util";
import { generateOpaqueToken } from "../src/common/crypto/token.util";

const prisma = new PrismaClient();

const MERKATO_BRANCH = {
  name: "Fresh Cup — Merkato",
  addressText: "Merkato, American Gibi, Addis Ababa, Ethiopia",
  lat: 9.0157,
  lng: 38.7369,
  phone: "+251911000000",
};

async function seedBranch() {
  const existing = await prisma.branch.findFirst({ where: { name: MERKATO_BRANCH.name } });
  if (existing) return existing;
  return prisma.branch.create({
    data: {
      ...MERKATO_BRANCH,
      organization: {
        connectOrCreate: {
          where: { slug: "fresh-cup" },
          create: { name: "Fresh Cup", slug: "fresh-cup", status: "ACTIVE" },
        },
      },
    },
  });
}

async function seedDevUser(options: {
  emailEnv: string;
  passwordEnv: string;
  fullName: string;
  role: UserRole;
  branchId: string;
}) {
  if (process.env.NODE_ENV === "production") return;

  const email = process.env[options.emailEnv];
  const password = process.env[options.passwordEnv];
  if (!email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      fullName: options.fullName,
      role: options.role,
      branchId: options.branchId,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded ${options.role} user: ${email}`);
}

interface SeedProduct {
  nameEn: string;
  nameAm: string;
  descriptionEn: string;
  basePrice: number;
  calories: number;
  tags: string[];
  imageUrl: string;
}

const CATEGORIES: Record<string, SeedProduct[]> = {
  "Fresh Juices": [
    {
      nameEn: "Mango Sunrise",
      nameAm: "ማንጎ ጭማቂ",
      descriptionEn: "Cold-pressed Ethiopian mango, nothing added.",
      basePrice: 12000,
      calories: 180,
      tags: ["vegan", "no-sugar-added"],
      imageUrl: "https://cdn.freshcupjuicehouse.com/menu/mango-sunrise.jpg",
    },
    {
      nameEn: "Orange Zest",
      nameAm: "ብርቱካን ጭማቂ",
      descriptionEn: "Freshly squeezed orange juice.",
      basePrice: 10000,
      calories: 150,
      tags: ["vegan", "no-sugar-added"],
      imageUrl: "https://cdn.freshcupjuicehouse.com/menu/orange-zest.jpg",
    },
    {
      nameEn: "Avocado Cream",
      nameAm: "አቮካዶ ጭማቂ",
      descriptionEn: "Creamy avocado blended with a touch of honey.",
      basePrice: 13500,
      calories: 260,
      tags: ["vegetarian"],
      imageUrl: "https://cdn.freshcupjuicehouse.com/menu/avocado-cream.jpg",
    },
  ],
  Smoothies: [
    {
      nameEn: "Berry Boost",
      nameAm: "ቤሪ ስሙዚ",
      descriptionEn: "Mixed berries, banana, and Greek yogurt.",
      basePrice: 15000,
      calories: 310,
      tags: ["vegetarian", "high-protein"],
      imageUrl: "https://cdn.freshcupjuicehouse.com/menu/berry-boost.jpg",
    },
    {
      nameEn: "Green Energy",
      nameAm: "አረንጓዴ ስሙዚ",
      descriptionEn: "Spinach, mango, banana, and coconut water.",
      basePrice: 14500,
      calories: 220,
      tags: ["vegan"],
      imageUrl: "https://cdn.freshcupjuicehouse.com/menu/green-energy.jpg",
    },
  ],
  "Healthy Bowls": [
    {
      nameEn: "Tropical Açaí Bowl",
      nameAm: "አሳይ ጎድጓዳ ሳህን",
      descriptionEn: "Açaí blend topped with granola, banana, and honey.",
      basePrice: 21000,
      calories: 420,
      tags: ["vegetarian"],
      imageUrl: "https://cdn.freshcupjuicehouse.com/menu/acai-bowl.jpg",
    },
  ],
  Snacks: [
    {
      nameEn: "Granola Energy Bar",
      nameAm: "ግራኖላ ባር",
      descriptionEn: "House-made oats, honey, and dried fruit bar.",
      basePrice: 6000,
      calories: 190,
      tags: ["vegetarian"],
      imageUrl: "https://cdn.freshcupjuicehouse.com/menu/granola-bar.jpg",
    },
  ],
};

async function seedCatalog(branchId: string) {
  let sortOrder = 0;
  for (const [categoryName, products] of Object.entries(CATEGORIES)) {
    let category = await prisma.menuCategory.findFirst({
      where: { branchId, nameEn: categoryName },
    });

    category ??= await prisma.menuCategory.create({
      data: { branchId, nameEn: categoryName, sortOrder: sortOrder++ },
    });

    let productSortOrder = 0;
    for (const product of products) {
      const existing = await prisma.menuItem.findFirst({
        where: { branchId, categoryId: category.id, nameEn: product.nameEn },
      });
      if (existing) continue;

      await prisma.menuItem.create({
        data: {
          branchId,
          categoryId: category.id,
          nameEn: product.nameEn,
          nameAm: product.nameAm,
          descriptionEn: product.descriptionEn,
          basePrice: product.basePrice,
          calories: product.calories,
          tags: product.tags,
          sortOrder: productSortOrder++,
          images: {
            create: [{ url: product.imageUrl, isPrimary: true, sortOrder: 0 }],
          },
        },
      });
    }
  }
}

const INVENTORY_ITEMS: Array<{
  name: string;
  unit: InventoryUnit;
  currentStock: number;
  reorderThreshold: number;
  unitCost: number;
}> = [
  {
    name: "Mango",
    unit: InventoryUnit.GRAM,
    currentStock: 20000,
    reorderThreshold: 5000,
    unitCost: 8,
  },
  {
    name: "Orange",
    unit: InventoryUnit.GRAM,
    currentStock: 25000,
    reorderThreshold: 5000,
    unitCost: 6,
  },
  {
    name: "Avocado",
    unit: InventoryUnit.GRAM,
    currentStock: 15000,
    reorderThreshold: 4000,
    unitCost: 12,
  },
  {
    name: "Greek Yogurt",
    unit: InventoryUnit.MILLILITER,
    currentStock: 10000,
    reorderThreshold: 2000,
    unitCost: 5,
  },
  {
    name: "Honey",
    unit: InventoryUnit.MILLILITER,
    currentStock: 5000,
    reorderThreshold: 1000,
    unitCost: 15,
  },
  {
    name: "Granola",
    unit: InventoryUnit.GRAM,
    currentStock: 8000,
    reorderThreshold: 2000,
    unitCost: 4,
  },
];

async function seedInventory(branchId: string) {
  for (const item of INVENTORY_ITEMS) {
    const existing = await prisma.inventoryItem.findFirst({
      where: { branchId, name: item.name },
    });
    if (existing) continue;

    await prisma.inventoryItem.create({ data: { ...item, branchId } });
  }
}

async function attachModifierGroupIfMissing(
  menuItemId: string,
  modifierGroupId: string,
  isRequired: boolean,
  sortOrder: number,
) {
  const existing = await prisma.menuItemModifierGroup.findUnique({
    where: { menuItemId_modifierGroupId: { menuItemId, modifierGroupId } },
  });
  if (existing) return;

  await prisma.menuItemModifierGroup.create({
    data: { menuItemId, modifierGroupId, isRequired, sortOrder },
  });
}

/** "Size" (required, single-select) on drinks; "Add-ons" (optional, multi-select) on smoothies/bowls. */
async function seedModifiers(branchId: string) {
  let sizeGroup = await prisma.modifierGroup.findFirst({ where: { branchId, nameEn: "Size" } });
  sizeGroup ??= await prisma.modifierGroup.create({
    data: {
      branchId,
      nameEn: "Size",
      nameAm: "መጠን",
      selectionType: ModifierSelectionType.SINGLE,
      minSelect: 1,
      maxSelect: 1,
      options: {
        create: [
          { nameEn: "Small", nameAm: "ትንሽ", priceDelta: 0, sortOrder: 0 },
          { nameEn: "Medium", nameAm: "መካከለኛ", priceDelta: 1000, sortOrder: 1 },
          { nameEn: "Large", nameAm: "ትልቅ", priceDelta: 2000, sortOrder: 2 },
        ],
      },
    },
  });

  let addOnsGroup = await prisma.modifierGroup.findFirst({
    where: { branchId, nameEn: "Add-ons" },
  });
  addOnsGroup ??= await prisma.modifierGroup.create({
    data: {
      branchId,
      nameEn: "Add-ons",
      nameAm: "ተጨማሪዎች",
      selectionType: ModifierSelectionType.MULTIPLE,
      minSelect: 0,
      maxSelect: 3,
      options: {
        create: [
          { nameEn: "Extra Protein Shot", nameAm: "ተጨማሪ ፕሮቲን", priceDelta: 800, sortOrder: 0 },
          { nameEn: "Chia Seeds", nameAm: "ቺያ ዘር", priceDelta: 500, sortOrder: 1 },
          { nameEn: "Extra Honey", nameAm: "ተጨማሪ ማር", priceDelta: 300, sortOrder: 2 },
        ],
      },
    },
  });

  const sizeCategories = ["Fresh Juices", "Smoothies"];
  const addOnCategories = ["Smoothies", "Healthy Bowls"];

  for (const categoryName of new Set([...sizeCategories, ...addOnCategories])) {
    const category = await prisma.menuCategory.findFirst({
      where: { branchId, nameEn: categoryName },
    });
    if (!category) continue;

    const items = await prisma.menuItem.findMany({ where: { branchId, categoryId: category.id } });
    for (const item of items) {
      if (sizeCategories.includes(categoryName)) {
        await attachModifierGroupIfMissing(item.id, sizeGroup.id, true, 0);
      }
      if (addOnCategories.includes(categoryName)) {
        await attachModifierGroupIfMissing(item.id, addOnsGroup.id, false, 1);
      }
    }
  }
}

const STATIONS = ["Juice Bar", "Smoothie Station", "Bowls & Snacks"] as const;

/** productName -> [stationName, prepTimeSeconds]. Unlisted products keep the schema default. */
const PRODUCT_STATIONS: Record<string, [(typeof STATIONS)[number], number]> = {
  "Mango Sunrise": ["Juice Bar", 90],
  "Orange Zest": ["Juice Bar", 90],
  "Avocado Cream": ["Juice Bar", 150],
  "Berry Boost": ["Smoothie Station", 180],
  "Green Energy": ["Smoothie Station", 180],
  "Tropical Açaí Bowl": ["Bowls & Snacks", 240],
  "Granola Energy Bar": ["Bowls & Snacks", 30],
};

async function seedKitchenStations(branchId: string): Promise<void> {
  const stationIdByName = new Map<string, string>();
  for (const name of STATIONS) {
    let station = await prisma.kitchenStation.findFirst({ where: { branchId, name } });
    station ??= await prisma.kitchenStation.create({ data: { branchId, name } });
    stationIdByName.set(name, station.id);
  }

  for (const [productName, [stationName, prepTimeSeconds]] of Object.entries(PRODUCT_STATIONS)) {
    const menuItem = await prisma.menuItem.findFirst({ where: { branchId, nameEn: productName } });
    if (!menuItem || menuItem.stationId) continue;
    await prisma.menuItem.update({
      where: { id: menuItem.id },
      data: { stationId: stationIdByName.get(stationName), prepTimeSeconds },
    });
  }
}

/** productName -> [inventoryItemName, quantityPerUnit]. Only ingredients already in INVENTORY_ITEMS. */
const PRODUCT_RECIPES: Record<string, Array<[string, number]>> = {
  "Mango Sunrise": [["Mango", 250]],
  "Orange Zest": [["Orange", 300]],
  "Avocado Cream": [
    ["Avocado", 200],
    ["Honey", 20],
  ],
  "Berry Boost": [
    ["Greek Yogurt", 150],
    ["Honey", 10],
  ],
  "Green Energy": [["Mango", 100]],
  "Tropical Açaí Bowl": [
    ["Granola", 50],
    ["Honey", 15],
  ],
  "Granola Energy Bar": [
    ["Granola", 80],
    ["Honey", 10],
  ],
};

async function seedRecipeIngredients(branchId: string): Promise<void> {
  for (const [productName, ingredients] of Object.entries(PRODUCT_RECIPES)) {
    const menuItem = await prisma.menuItem.findFirst({ where: { branchId, nameEn: productName } });
    if (!menuItem) continue;

    for (const [inventoryItemName, quantityPerUnit] of ingredients) {
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: { branchId, name: inventoryItemName },
      });
      if (!inventoryItem) continue;

      await prisma.recipeIngredient.upsert({
        where: {
          menuItemId_inventoryItemId: {
            menuItemId: menuItem.id,
            inventoryItemId: inventoryItem.id,
          },
        },
        update: {},
        create: { menuItemId: menuItem.id, inventoryItemId: inventoryItem.id, quantityPerUnit },
      });
    }
  }
}

async function seedDriver(branchId: string): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const email = process.env.DRIVER_SEED_EMAIL;
  const password = process.env.DRIVER_SEED_PASSWORD;
  if (!email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      fullName: "Merkato Delivery Driver",
      role: UserRole.DRIVER,
      branchId,
      driverProfile: { create: { vehicleType: "motorcycle", licensePlate: "AA-12345" } },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded DRIVER user: ${email}`);
}

async function seedDeliveryZone(branchId: string): Promise<void> {
  const existing = await prisma.deliveryZone.findFirst({
    where: { branchId, name: "Merkato Core" },
  });
  if (existing) return;

  await prisma.deliveryZone.create({
    data: {
      branchId,
      name: "Merkato Core",
      centerLat: MERKATO_BRANCH.lat,
      centerLng: MERKATO_BRANCH.lng,
      radiusKm: 5,
      baseFee: 3000,
      perKmFee: 500,
    },
  });
}

async function seedSupplier(branchId: string): Promise<void> {
  const name = "Addis Fresh Produce Suppliers";
  const existing = await prisma.supplier.findFirst({ where: { branchId, name } });
  if (existing) return;

  await prisma.supplier.create({
    data: {
      branchId,
      name,
      contactName: "Selam Tesfaye",
      phone: "+251911234567",
      email: "orders@addisfreshproduce.et",
      address: "Merkato, Addis Ababa, Ethiopia",
    },
  });
}

async function seedTable(branchId: string) {
  const existing = await prisma.table.findFirst({ where: { branchId, label: "T-1" } });
  if (existing) return;

  await prisma.table.create({ data: { branchId, label: "T-1", qrToken: generateOpaqueToken() } });
}

async function seedCoupon() {
  const existing = await prisma.coupon.findUnique({ where: { code: "WELCOME10" } });
  if (existing) return;

  await prisma.coupon.create({
    data: {
      code: "WELCOME10",
      discountType: DiscountType.PERCENT,
      value: 10,
      minOrderTotal: 5000,
      maxRedemptionsPerUser: 1,
    },
  });
}

async function main() {
  const branch = await seedBranch();

  await seedCatalog(branch.id);
  await seedInventory(branch.id);
  await seedModifiers(branch.id);
  await seedTable(branch.id);
  await seedCoupon();

  await seedKitchenStations(branch.id);
  await seedRecipeIngredients(branch.id);
  await seedDeliveryZone(branch.id);
  await seedSupplier(branch.id);
  await seedDriver(branch.id);

  await seedDevUser({
    emailEnv: "ADMIN_SEED_EMAIL",
    passwordEnv: "ADMIN_SEED_PASSWORD",
    fullName: "Fresh Cup Admin",
    role: UserRole.ADMIN,
    branchId: branch.id,
  });
  await seedDevUser({
    emailEnv: "MANAGER_SEED_EMAIL",
    passwordEnv: "MANAGER_SEED_PASSWORD",
    fullName: "Merkato Branch Manager",
    role: UserRole.MANAGER,
    branchId: branch.id,
  });
  await seedDevUser({
    emailEnv: "STAFF_SEED_EMAIL",
    passwordEnv: "STAFF_SEED_PASSWORD",
    fullName: "Merkato Counter Staff",
    role: UserRole.STAFF,
    branchId: branch.id,
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
