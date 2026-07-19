import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RecommendationOutcomeStatus } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional } from "class-validator";

export class DecideOutcomeDto {
  @ApiProperty({
    enum: [
      RecommendationOutcomeStatus.ACCEPTED,
      RecommendationOutcomeStatus.IGNORED,
      RecommendationOutcomeStatus.REJECTED,
    ],
  })
  @IsEnum(RecommendationOutcomeStatus)
  status!: Exclude<RecommendationOutcomeStatus, "PENDING">;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  actualImpact?: number;
}
