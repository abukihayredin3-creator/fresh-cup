import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Min } from "class-validator";

/**
 * URL-based: the client uploads to object storage (S3/MinIO) directly or via
 * a signed URL and registers the resulting URL here. No multipart upload
 * pipeline exists yet — that's infrastructure, not core business logic.
 */
export class CreateMenuItemImageDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
