import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateDriverAvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  isOnline!: boolean;
}
