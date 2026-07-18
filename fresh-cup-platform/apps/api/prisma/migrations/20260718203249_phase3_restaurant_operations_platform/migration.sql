/*
  Warnings:

  - Added the required column `prep_time_seconds` to the `order_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "InventoryTransactionReason" ADD VALUE 'ORDER_DEDUCTION';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'DRIVER';

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "prep_time_seconds" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN     "station_id" TEXT;

-- AlterTable
-- DEFAULT 180 backfills the 193 pre-Phase-3 rows (application code always
-- sets this explicitly on new inserts, matching menu_items.prep_time_seconds
-- at checkout time — this default only exists so the NOT NULL column can be
-- added without a data migration).
ALTER TABLE "order_items" ADD COLUMN     "prep_time_seconds" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN     "station_id" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "preparing_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "kitchen_stations" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kitchen_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_profiles" (
    "user_id" TEXT NOT NULL,
    "vehicle_type" TEXT NOT NULL,
    "license_plate" TEXT,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "current_lat" DECIMAL(9,6),
    "current_lng" DECIMAL(9,6),
    "last_ping_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "center_lat" DECIMAL(9,6) NOT NULL,
    "center_lng" DECIMAL(9,6) NOT NULL,
    "radius_km" DECIMAL(6,2) NOT NULL,
    "base_fee" INTEGER NOT NULL,
    "per_km_fee" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "zone_id" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "distance_km" DECIMAL(6,2),
    "fee" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_tracking_pings" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_tracking_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "quantity_per_unit" DECIMAL(12,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "quantity_ordered" DECIMAL(12,3) NOT NULL,
    "unit_cost" INTEGER NOT NULL,
    "quantity_received" DECIMAL(12,3),

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kitchen_stations_branch_id_idx" ON "kitchen_stations"("branch_id");

-- CreateIndex
CREATE INDEX "delivery_zones_branch_id_idx" ON "delivery_zones"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_order_id_key" ON "deliveries"("order_id");

-- CreateIndex
CREATE INDEX "deliveries_branch_id_status_idx" ON "deliveries"("branch_id", "status");

-- CreateIndex
CREATE INDEX "deliveries_driver_id_idx" ON "deliveries"("driver_id");

-- CreateIndex
CREATE INDEX "delivery_tracking_pings_delivery_id_recorded_at_idx" ON "delivery_tracking_pings"("delivery_id", "recorded_at");

-- CreateIndex
CREATE INDEX "recipe_ingredients_inventory_item_id_idx" ON "recipe_ingredients"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_menu_item_id_inventory_item_id_key" ON "recipe_ingredients"("menu_item_id", "inventory_item_id");

-- CreateIndex
CREATE INDEX "suppliers_branch_id_idx" ON "suppliers"("branch_id");

-- CreateIndex
CREATE INDEX "purchase_orders_branch_id_status_idx" ON "purchase_orders"("branch_id", "status");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchase_order_id_idx" ON "purchase_order_lines"("purchase_order_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "menu_items_station_id_idx" ON "menu_items"("station_id");

-- CreateIndex
CREATE INDEX "order_items_station_id_idx" ON "order_items"("station_id");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "kitchen_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_stations" ADD CONSTRAINT "kitchen_stations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tracking_pings" ADD CONSTRAINT "delivery_tracking_pings_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
