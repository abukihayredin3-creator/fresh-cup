import { ApiProperty } from "@nestjs/swagger";

export class DashboardResponseDto {
  @ApiProperty({ description: "ETB minor units" })
  todayRevenue!: number;

  @ApiProperty()
  todayOrders!: number;

  @ApiProperty({ description: "Orders confirmed but not yet completed/delivered" })
  activeOrders!: number;

  @ApiProperty({ description: "Deliveries not yet delivered or failed" })
  pendingDeliveries!: number;

  @ApiProperty()
  lowStockItemCount!: number;

  @ApiProperty({ description: "ETB minor units, rolling 7-day window ending today" })
  last7DaysRevenue!: number;
}
