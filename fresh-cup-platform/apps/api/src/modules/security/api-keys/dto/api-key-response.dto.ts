import { ApiProperty } from "@nestjs/swagger";

export class ApiKeyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "First few characters of the key, for identification" })
  keyPrefix!: string;

  @ApiProperty({ nullable: true })
  lastUsedAt!: Date | null;

  @ApiProperty({ nullable: true })
  revokedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class CreatedApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty({ description: "The full API key — shown once, never retrievable again" })
  key!: string;
}
