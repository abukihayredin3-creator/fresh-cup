import { ApiProperty } from "@nestjs/swagger";

export class FeatureContributionDto {
  @ApiProperty()
  feature!: string;

  @ApiProperty()
  value!: number;

  @ApiProperty()
  weight!: number;

  @ApiProperty()
  contribution!: number;

  @ApiProperty({ enum: ["positive", "negative"] })
  direction!: "positive" | "negative";
}

/**
 * Every prediction in this platform returns this shape — Core requirement
 * from the Phase 11 Part 2 spec: a prediction is never returned without a
 * confidence score, an explanation, contributing factors, and a
 * recommended action.
 */
export class PredictionResultDto<T = number> {
  @ApiProperty()
  modelKey!: string;

  @ApiProperty()
  modelVersion!: number;

  @ApiProperty({
    description:
      "The prediction itself — a 0-1 probability for classification-style models, a currency/count value for regression-style ones",
  })
  prediction!: T;

  @ApiProperty({
    minimum: 0,
    maximum: 1,
    description: "Calibrated confidence, see ConfidenceCalibratorService",
  })
  confidence!: number;

  @ApiProperty({ type: [String] })
  topReasons!: string[];

  @ApiProperty({ type: [FeatureContributionDto] })
  contributingFactors!: FeatureContributionDto[];

  @ApiProperty()
  suggestedAction!: string;
}
