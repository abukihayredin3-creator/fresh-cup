import { ApiProperty } from "@nestjs/swagger";

export class SalesByDayDto {
  @ApiProperty({ description: "YYYY-MM-DD" })
  date!: string;

  @ApiProperty({ description: "ETB minor units" })
  revenue!: number;

  @ApiProperty()
  orders!: number;
}

export class SalesAnalyticsResponseDto {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;

  @ApiProperty({ description: "ETB minor units" })
  totalRevenue!: number;

  @ApiProperty()
  totalOrders!: number;

  @ApiProperty({ description: "ETB minor units" })
  averageOrderValue!: number;

  @ApiProperty({ type: [SalesByDayDto] })
  byDay!: SalesByDayDto[];
}
