import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, MinLength } from "class-validator";

export class CreateTableDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ example: "T-12" })
  @IsString()
  @MinLength(1)
  label!: string;
}
