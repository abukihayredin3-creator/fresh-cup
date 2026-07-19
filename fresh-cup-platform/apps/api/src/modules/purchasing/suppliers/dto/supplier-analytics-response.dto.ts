import { ApiProperty } from "@nestjs/swagger";

export class SupplierAnalyticsResponseDto {
  @ApiProperty()
  supplierId!: string;

  @ApiProperty()
  totalOrders!: number;

  @ApiProperty()
  receivedOrders!: number;

  @ApiProperty()
  cancelledOrders!: number;

  @ApiProperty({
    description: "Sum of (quantityOrdered * unitCost) across received orders, in ETB minor units",
  })
  totalSpend!: number;

  @ApiProperty({ description: "Sum of purchase order payments, in ETB minor units" })
  totalPaid!: number;

  @ApiProperty({
    nullable: true,
    description: "Average days between submittedAt and receivedAt across received orders",
  })
  avgLeadTimeDays!: number | null;

  @ApiProperty({ description: "receivedOrders / totalOrders, 0 when there are no orders" })
  fulfillmentRate!: number;
}
