import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class VerifyWebAuthnRegistrationDto {
  @ApiProperty({
    description: "base64url-encoded clientDataJSON from navigator.credentials.create()",
  })
  @IsString()
  @MinLength(1)
  clientDataJSON!: string;

  @ApiProperty({ description: "base64url-encoded attestationObject" })
  @IsString()
  @MinLength(1)
  attestationObject!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceName?: string;
}
