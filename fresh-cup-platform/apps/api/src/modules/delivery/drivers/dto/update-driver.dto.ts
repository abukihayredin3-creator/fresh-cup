import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateDriverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licensePlate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
