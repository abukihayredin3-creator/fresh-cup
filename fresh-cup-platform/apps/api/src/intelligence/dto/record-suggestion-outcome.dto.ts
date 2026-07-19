import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class RecordSuggestionOutcomeDto {
  @ApiProperty({
    description: "true if the manager accepted the AI's suggestion, false if rejected",
  })
  @IsBoolean()
  accepted!: boolean;
}
