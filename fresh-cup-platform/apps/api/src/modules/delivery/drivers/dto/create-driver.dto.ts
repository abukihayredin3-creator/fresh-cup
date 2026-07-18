import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateDriverDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  fullName!: string;

  @ApiProperty({ example: "motorcycle" })
  @IsString()
  @MinLength(1)
  vehicleType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licensePlate?: string;
}
