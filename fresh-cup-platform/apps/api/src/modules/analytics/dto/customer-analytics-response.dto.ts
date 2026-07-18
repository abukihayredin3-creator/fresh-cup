import { ApiProperty } from "@nestjs/swagger";

export class CustomerAnalyticsEntryDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  ordersCount!: number;

  @ApiProperty({ description: "ETB minor units" })
  totalSpend!: number;
}

export class CustomerAnalyticsResponseDto {
  @ApiProperty({ type: [CustomerAnalyticsEntryDto] })
  customers!: CustomerAnalyticsEntryDto[];
}
