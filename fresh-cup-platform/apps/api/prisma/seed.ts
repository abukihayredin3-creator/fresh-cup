/**
 * Seeds one branch, a starter menu (categories + products + images), and a
 * handful of inventory items so the catalog/inventory endpoints have real
 * data to browse in development. Idempotent — safe to re-run.
 *
 * Admin/manager/staff dev accounts are only created when NODE_ENV is not
 * "production" AND the corresponding *_SEED_EMAIL/_SEED_PASSWORD env vars
 * are set — never accidentally in a real environment.
 */
import { PrismaClient, InventoryUnit, UserRole } from "@prisma/client";
import { hashPassword } from "../src/common/crypto/password.util";

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
  return prisma.branch.create({ data: MERKATO_BRANCH });
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

async function main() {
  const branch = await seedBranch();

  await seedCatalog(branch.id);
  await seedInventory(branch.id);

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
