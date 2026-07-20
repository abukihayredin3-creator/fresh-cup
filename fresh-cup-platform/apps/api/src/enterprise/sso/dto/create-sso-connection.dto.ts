import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SsoProviderType } from "@prisma/client";
import { IsEnum, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class CreateSsoConnectionDto {
  @ApiProperty({ enum: SsoProviderType })
  @IsEnum(SsoProviderType)
  provider!: SsoProviderType;

  @ApiProperty({ example: "Corporate Google Workspace" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: "acme.com" })
  @IsOptional()
  @IsString()
  domainHint?: string;

  @ApiProperty({
    description:
      "Non-secret config: OIDC {issuer, clientId, scope?} or SAML {idpSsoUrl, spEntityId, acsUrl}",
  })
  @IsObject()
  config!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Name of the env var holding the OIDC client secret — never the secret itself",
  })
  @IsOptional()
  @IsString()
  clientSecretEnvVar?: string;
}
