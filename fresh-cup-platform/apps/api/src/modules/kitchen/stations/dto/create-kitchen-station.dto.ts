import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, MinLength } from "class-validator";

export class CreateKitchenStationDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ example: "Cold Bar" })
  @IsString()
  @MinLength(1)
  name!: string;
}
