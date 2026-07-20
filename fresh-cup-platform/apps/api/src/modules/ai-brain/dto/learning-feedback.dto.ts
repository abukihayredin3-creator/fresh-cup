import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsString, IsUUID } from "class-validator";

export class LearningFeedbackDto {
  @ApiProperty({ description: "The AiRecommendation this feedback is about" })
  @IsUUID()
  recommendationId!: string;

  @ApiProperty({
    description:
      'The observed result. A value of "accepted", "rejected", or "implemented" (case-insensitive) also advances the recommendation\'s status; anything else is recorded as a free-form outcome.',
  })
  @IsString()
  result!: string;

  @ApiProperty({ type: Object, description: "Free-form structured detail about the outcome" })
  @IsObject()
  feedback!: Record<string, unknown>;
}
