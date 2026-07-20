-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimal_digits" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "base_currency_code" TEXT NOT NULL,
    "quote_currency_code" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "as_of" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "region_id" TEXT,
    "menu_category_id" TEXT,
    "name" TEXT NOT NULL,
    "rate_percent" DECIMAL(6,3) NOT NULL,
    "is_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regional_price_overrides" (
    "id" TEXT NOT NULL,
    "region_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regional_price_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_payment_method_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "local_payment_method_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "legal_footer_text" TEXT,
    "show_tax_breakdown" BOOLEAN NOT NULL DEFAULT true,
    "show_vat_number" BOOLEAN NOT NULL DEFAULT false,
    "vat_number" TEXT,
    "date_format" TEXT NOT NULL DEFAULT 'YYYY-MM-DD HH:mm',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_organization_id_base_currency_code_quote_cur_key" ON "exchange_rates"("organization_id", "base_currency_code", "quote_currency_code");

-- CreateIndex
CREATE INDEX "tax_rules_organization_id_country_code_idx" ON "tax_rules"("organization_id", "country_code");

-- CreateIndex
CREATE UNIQUE INDEX "regional_price_overrides_region_id_menu_item_id_key" ON "regional_price_overrides"("region_id", "menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "local_payment_method_configs_organization_id_country_code_m_key" ON "local_payment_method_configs"("organization_id", "country_code", "method");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_templates_organization_id_country_code_key" ON "receipt_templates"("organization_id", "country_code");

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_menu_category_id_fkey" FOREIGN KEY ("menu_category_id") REFERENCES "menu_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regional_price_overrides" ADD CONSTRAINT "regional_price_overrides_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regional_price_overrides" ADD CONSTRAINT "regional_price_overrides_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_payment_method_configs" ADD CONSTRAINT "local_payment_method_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_templates" ADD CONSTRAINT "receipt_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
