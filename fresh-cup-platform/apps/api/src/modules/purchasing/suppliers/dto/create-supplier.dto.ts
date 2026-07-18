import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsPhoneNumber, IsString, IsUUID, MinLength } from "class-validator";

export class CreateSupplierDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ example: "Merkato Produce Co." })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}
