import { ApiProperty } from "@nestjs/swagger";
import { IsPhoneNumber, Length } from "class-validator";

export class VerifyOtpDto {
  @ApiProperty({ example: "+251911223344" })
  @IsPhoneNumber()
  phone!: string;

  @ApiProperty({ example: "042817", minLength: 6, maxLength: 6 })
  @Length(6, 6)
  code!: string;
}
