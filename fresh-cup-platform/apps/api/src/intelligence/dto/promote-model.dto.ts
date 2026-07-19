import { ApiProperty } from "@nestjs/swagger";
import { PredictiveModelStage } from "@prisma/client";
import { IsEnum } from "class-validator";

export class PromoteModelDto {
  @ApiProperty({ enum: PredictiveModelStage })
  @IsEnum(PredictiveModelStage)
  stage!: PredictiveModelStage;
}
