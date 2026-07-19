import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: "growth" })
  @IsString()
  @MinLength(1)
  key!: string;

  @ApiProperty({ example: "Growth" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxBranches?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional({ description: "Minor units (e.g. ETB cents)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMonthlyMinor?: number;

  @ApiProperty({ type: [String], example: ["enterprise.sso", "enterprise.scim"] })
  @IsArray()
  @IsString({ each: true })
  features!: string[];
}
