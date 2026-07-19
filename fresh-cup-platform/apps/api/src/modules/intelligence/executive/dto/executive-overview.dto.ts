import { ApiProperty } from "@nestjs/swagger";

export class RevenueTrendPointDto {
  @ApiProperty()
  date!: string;

  @ApiProperty({ description: "ETB minor units" })
  revenue!: number;

  @ApiProperty({ description: "ETB minor units, revenue minus estimated recipe COGS" })
  estimatedProfit!: number;
}

export class ProductProfitabilityDto {
  @ApiProperty()
  menuItemId!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty({ description: "ETB minor units" })
  revenue!: number;

  @ApiProperty({
    description: "ETB minor units, from RecipeIngredient.quantityPerUnit * InventoryItem.unitCost",
  })
  estimatedCogs!: number;

  @ApiProperty({ description: "ETB minor units" })
  estimatedMargin!: number;
}

export class BranchComparisonDto {
  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "ETB minor units" })
  revenue!: number;

  @ApiProperty()
  orders!: number;

  @ApiProperty({ description: "ETB minor units" })
  avgOrderValue!: number;
}

export class CustomerGrowthPointDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  newCustomers!: number;
}

export class PeakHourDto {
  @ApiProperty({ minimum: 0, maximum: 23 })
  hour!: number;

  @ApiProperty()
  orderCount!: number;
}

export class ConversionMetricsDto {
  @ApiProperty()
  cartsCreated!: number;

  @ApiProperty()
  ordersPlaced!: number;

  @ApiProperty({ description: "0-1" })
  conversionRate!: number;
}

export class InventoryCostsDto {
  @ApiProperty({ description: "ETB minor units, RECEIVED purchase orders in range" })
  purchasingSpend!: number;

  @ApiProperty({ description: "ETB minor units, WASTE-reason ledger entries in range" })
  wasteCost!: number;
}

export class MarketingRoiDto {
  @ApiProperty({ description: "ETB minor units" })
  couponDiscountGiven!: number;

  @ApiProperty({ description: "ETB minor units" })
  revenueFromCouponOrders!: number;

  @ApiProperty({
    description: "revenueFromCouponOrders / couponDiscountGiven, null if no discounts given",
  })
  returnPerDiscountBirr!: number | null;
}

export class ExecutiveOverviewDto {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;

  @ApiProperty({ description: "ETB minor units" })
  totalRevenue!: number;

  @ApiProperty({ description: "ETB minor units" })
  totalEstimatedProfit!: number;

  @ApiProperty({
    description: "0-1, customers with >1 order in range / customers with >=1 order in range",
  })
  repeatCustomerRate!: number;

  @ApiProperty({ type: [RevenueTrendPointDto] })
  revenueTrend!: RevenueTrendPointDto[];

  @ApiProperty({ type: [ProductProfitabilityDto] })
  productProfitability!: ProductProfitabilityDto[];

  @ApiProperty({ type: [BranchComparisonDto] })
  branchComparison!: BranchComparisonDto[];

  @ApiProperty({ type: [CustomerGrowthPointDto] })
  customerGrowth!: CustomerGrowthPointDto[];

  @ApiProperty({ type: [PeakHourDto] })
  peakHours!: PeakHourDto[];

  @ApiProperty({ type: ConversionMetricsDto })
  conversionMetrics!: ConversionMetricsDto;

  @ApiProperty({ type: InventoryCostsDto })
  inventoryCosts!: InventoryCostsDto;

  @ApiProperty({ type: MarketingRoiDto })
  marketingRoi!: MarketingRoiDto;
}
