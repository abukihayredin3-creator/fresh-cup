import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class TrustDeviceDto {
  @ApiProperty({ description: "Client-generated device fingerprint (never stored raw — hashed)" })
  @IsString()
  @MinLength(8)
  fingerprint!: string;

  @ApiPropertyOptional({ example: "Sarah's MacBook Pro" })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  ttlDays?: number;
}
