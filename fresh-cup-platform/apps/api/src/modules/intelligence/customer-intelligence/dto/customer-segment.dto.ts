import { ApiProperty } from "@nestjs/swagger";

export class RfmScoreDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  recency!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  frequency!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  monetary!: number;
}

export class CustomerSegmentDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  recencyDays!: number;

  @ApiProperty()
  ordersCount!: number;

  @ApiProperty({ description: "ETB minor units, lifetime" })
  totalSpend!: number;

  @ApiProperty({ type: RfmScoreDto })
  rfm!: RfmScoreDto;

  @ApiProperty({
    description: "Champions | Loyal Customers | New Customers | At Risk | Need Attention | Lost",
  })
  segment!: string;

  @ApiProperty({ description: "0-1, higher means more likely to churn" })
  churnRisk!: number;

  @ApiProperty({ description: "ETB minor units, predicted lifetime value" })
  predictedLtv!: number;
}

export class CustomerSegmentsResponseDto {
  @ApiProperty({ type: [CustomerSegmentDto] })
  customers!: CustomerSegmentDto[];
}

export class SegmentSummaryEntryDto {
  @ApiProperty()
  segment!: string;

  @ApiProperty()
  customerCount!: number;

  @ApiProperty({ description: "ETB minor units, summed across the segment" })
  totalSpend!: number;
}

export class SegmentSummaryResponseDto {
  @ApiProperty({ type: [SegmentSummaryEntryDto] })
  segments!: SegmentSummaryEntryDto[];
}
