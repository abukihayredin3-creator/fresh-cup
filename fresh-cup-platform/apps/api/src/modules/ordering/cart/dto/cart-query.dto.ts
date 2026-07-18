import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CartQueryDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;
}
