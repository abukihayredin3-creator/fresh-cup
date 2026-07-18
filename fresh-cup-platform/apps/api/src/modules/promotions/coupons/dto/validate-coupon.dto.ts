import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Min } from "class-validator";

export class ValidateCouponDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty({ description: "Cart subtotal in ETB minor units" })
  @IsInt()
  @Min(0)
  subtotal!: number;
}
