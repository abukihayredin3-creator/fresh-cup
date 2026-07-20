import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class VerifyWebAuthnAssertionDto {
  @ApiProperty({
    description: "base64url-encoded credential id returned by navigator.credentials.get()",
  })
  @IsString()
  @MinLength(1)
  credentialId!: string;

  @ApiProperty({ description: "base64url-encoded clientDataJSON" })
  @IsString()
  @MinLength(1)
  clientDataJSON!: string;

  @ApiProperty({ description: "base64url-encoded authenticatorData" })
  @IsString()
  @MinLength(1)
  authenticatorData!: string;

  @ApiProperty({ description: "base64url-encoded assertion signature" })
  @IsString()
  @MinLength(1)
  signature!: string;
}
