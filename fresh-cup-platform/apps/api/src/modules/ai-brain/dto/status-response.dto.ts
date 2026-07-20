import { ApiProperty } from "@nestjs/swagger";

export class AiBrainStatusResponseDto {
  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  insightCount!: number;

  @ApiProperty()
  memoryCount!: number;

  @ApiProperty()
  recommendationCount!: number;

  @ApiProperty()
  pendingRecommendationCount!: number;

  @ApiProperty()
  decisionCount!: number;

  @ApiProperty({
    description:
      "Which PredictionProvider is currently active — see prediction-provider.interface.ts",
  })
  predictionProvider!: string;

  @ApiProperty()
  generatedAt!: Date;
}
