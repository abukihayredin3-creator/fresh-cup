import { ApiProperty } from "@nestjs/swagger";

export class ForecastPointDto {
  @ApiProperty({ description: "ISO date/time the prediction is for" })
  targetPeriodStart!: string;

  @ApiProperty()
  predictedValue!: number;

  @ApiProperty({ nullable: true, description: "Filled in once the period has passed" })
  actualValue!: number | null;

  @ApiProperty({ description: "0-1" })
  confidence!: number;
}

export class ForecastSeriesDto {
  @ApiProperty()
  metric!: string;

  @ApiProperty()
  granularity!: string;

  @ApiProperty()
  modelVersion!: number;

  @ApiProperty({ type: [ForecastPointDto] })
  points!: ForecastPointDto[];
}

export class ProductDemandForecastDto {
  @ApiProperty()
  menuItemId!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty({ type: [ForecastPointDto] })
  points!: ForecastPointDto[];
}

export class HourlyDemandPointDto {
  @ApiProperty({ minimum: 0, maximum: 23 })
  hour!: number;

  @ApiProperty()
  predictedOrders!: number;

  @ApiProperty({ description: "Relative to the day's average hour, 1.0 = average" })
  seasonalIndex!: number;
}
