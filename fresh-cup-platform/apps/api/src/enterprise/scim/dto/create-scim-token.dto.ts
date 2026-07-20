import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateScimTokenDto {
  @ApiProperty({ example: "Okta SCIM provisioning" })
  @IsString()
  @MinLength(1)
  name!: string;
}
