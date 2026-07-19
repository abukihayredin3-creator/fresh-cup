import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateFeatureFlagDefinitionDto {
  @ApiProperty({ example: "enterprise.sso", description: "Stable, dot-namespaced flag key" })
  @IsString()
  @Matches(/^[a-z0-9]+(\.[a-z0-9-]+)*$/, {
    message: "key must be lowercase, dot-namespaced (e.g. 'enterprise.sso')",
  })
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  defaultEnabled?: boolean;
}
