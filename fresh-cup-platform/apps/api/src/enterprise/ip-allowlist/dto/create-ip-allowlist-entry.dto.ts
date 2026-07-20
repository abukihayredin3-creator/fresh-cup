import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";

const CIDR_PATTERN = /^([0-9a-fA-F:.]+)(\/\d{1,3})?$/;

export class CreateIpAllowlistEntryDto {
  @ApiProperty({ example: "203.0.113.0/24" })
  @IsString()
  @Matches(CIDR_PATTERN, { message: "cidr must look like an IPv4/IPv6 address or CIDR range" })
  cidr!: string;

  @ApiPropertyOptional({ example: "Corporate VPN egress" })
  @IsOptional()
  @IsString()
  description?: string;
}
