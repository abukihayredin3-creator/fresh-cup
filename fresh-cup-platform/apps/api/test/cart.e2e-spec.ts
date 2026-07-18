import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { SMS_PROVIDER } from "../src/modules/auth/sms/sms-provider.interface";
import type { PrismaService } from "../src/database/prisma.service";
import { CapturingSmsProvider } from "./utils/capturing-sms.provider";
import {
  createTestBranch,
  createTestCategory,
  createTestMenuItem,
  loginAsNewCustomer,
} from "./utils/fixtures";
import { createTestApp } from "./utils/test-app";

describe("Cart (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: CapturingSmsProvider;

  beforeAll(async () => {
    const capturingSms = new CapturingSmsProvider();
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(SMS_PROVIDER).useValue(capturingSms),
    ));
    sms = capturingSms;
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupCustomerAndItem() {
    const branch = await createTestBranch(prisma);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, { basePrice: 10000 });
    const { accessToken } = await loginAsNewCustomer(app, sms);
    return { branch, menuItem, accessToken };
  }

  it("returns an empty virtual cart when nothing has been added yet", async () => {
    const branch = await createTestBranch(prisma);
    const { accessToken } = await loginAsNewCustomer(app, sms);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/cart?branchId=${branch.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({ id: null, items: [], subtotal: 0, itemCount: 0 });
  });

  it("adds an item and computes totals", async () => {
    const { branch, menuItem, accessToken } = await setupCustomerAndItem();

    const response = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 2 })
      .expect(201);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      quantity: 2,
      unitPrice: 10000,
      lineTotal: 20000,
    });
    expect(response.body.subtotal).toBe(20000);
    expect(response.body.itemCount).toBe(2);
  });

  it("merges an identical add-item call into the existing line instead of duplicating it", async () => {
    const { branch, menuItem, accessToken } = await setupCustomerAndItem();

    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 1 })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 1 })
      .expect(201);

    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].quantity).toBe(2);
  });

  it("updates quantity and removes an item", async () => {
    const { branch, menuItem, accessToken } = await setupCustomerAndItem();

    const added = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, quantity: 1 })
      .expect(201);
    const itemId = added.body.items[0].id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${itemId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ quantity: 5 })
      .expect(200);
    expect(updated.body.items[0].quantity).toBe(5);

    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/cart/items/${itemId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(removed.body.items).toHaveLength(0);
  });

  it("rejects adding an unavailable item", async () => {
    const branch = await createTestBranch(prisma);
    const category = await createTestCategory(prisma, branch.id);
    const menuItem = await createTestMenuItem(prisma, branch.id, category.id, {
      isAvailable: false,
    });
    const { accessToken } = await loginAsNewCustomer(app, sms);

    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id })
      .expect(400);
  });

  it("rejects a required modifier group left unselected", async () => {
    const { branch, menuItem, accessToken } = await setupCustomerAndItem();
    const group = await prisma.modifierGroup.create({
      data: {
        branchId: branch.id,
        nameEn: "Size",
        selectionType: "SINGLE",
        minSelect: 1,
        maxSelect: 1,
      },
    });
    await prisma.menuItemModifierGroup.create({
      data: { menuItemId: menuItem.id, modifierGroupId: group.id, isRequired: true },
    });

    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id })
      .expect(400);
  });

  it("prices a selected modifier into unitPrice", async () => {
    const { branch, menuItem, accessToken } = await setupCustomerAndItem();
    const group = await prisma.modifierGroup.create({
      data: {
        branchId: branch.id,
        nameEn: "Size",
        selectionType: "SINGLE",
        minSelect: 1,
        maxSelect: 1,
      },
    });
    const option = await prisma.modifierOption.create({
      data: { modifierGroupId: group.id, nameEn: "Large", priceDelta: 2500 },
    });
    await prisma.menuItemModifierGroup.create({
      data: { menuItemId: menuItem.id, modifierGroupId: group.id, isRequired: true },
    });

    const response = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id, modifierOptionIds: [option.id] })
      .expect(201);

    expect(response.body.items[0].unitPrice).toBe(12500); // 10000 base + 2500 delta
  });

  it("clears the entire cart", async () => {
    const { branch, menuItem, accessToken } = await setupCustomerAndItem();
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/cart?branchId=${branch.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/cart?branchId=${branch.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body.items).toHaveLength(0);
  });

  it("keeps carts isolated between users", async () => {
    const { branch, menuItem, accessToken } = await setupCustomerAndItem();
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId: branch.id, menuItemId: menuItem.id })
      .expect(201);

    const { accessToken: otherToken } = await loginAsNewCustomer(app, sms);
    const other = await request(app.getHttpServer())
      .get(`/api/v1/cart?branchId=${branch.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(200);
    expect(other.body.items).toHaveLength(0);
  });
});
