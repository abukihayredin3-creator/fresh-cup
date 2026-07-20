import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class SsoOidcCallbackDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  state!: string;

  @ApiProperty()
  @IsString()
  redirectUri!: string;
}

export class SsoSamlCallbackDto {
  @ApiProperty({ description: "The raw SAMLResponse form field, base64-encoded" })
  @IsString()
  @MinLength(1)
  samlResponse!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relayState?: string;
}
