import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DiscountType } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Min } from "class-validator";

export class CreateCouponDto {
  @ApiProperty({ example: "WELCOME10", description: "Normalized to uppercase server-side" })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/, {
    message: "code must be 3-32 letters, digits, hyphens or underscores",
  })
  code!: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @ApiPropertyOptional({
    description:
      "Percent (0-100) or ETB minor units, depending on discountType; ignored for FREE_DELIVERY",
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ description: "ETB minor units" })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderTotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptionsPerUser?: number;
}
