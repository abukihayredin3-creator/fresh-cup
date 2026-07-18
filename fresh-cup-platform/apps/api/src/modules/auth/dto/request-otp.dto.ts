import { ApiProperty } from "@nestjs/swagger";
import { IsPhoneNumber } from "class-validator";

export class RequestOtpDto {
  @ApiProperty({ example: "+251911223344", description: "E.164 phone number" })
  @IsPhoneNumber()
  phone!: string;
}
