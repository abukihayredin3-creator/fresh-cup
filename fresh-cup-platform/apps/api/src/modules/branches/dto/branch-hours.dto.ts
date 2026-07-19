import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BranchHoursDayDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: "0 = Sunday .. 6 = Saturday" })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ required: false, example: "08:00" })
  @IsOptional()
  @IsString()
  @Matches(HHMM_PATTERN, { message: "opensAt must be HH:mm" })
  opensAt?: string;

  @ApiProperty({ required: false, example: "20:00" })
  @IsOptional()
  @IsString()
  @Matches(HHMM_PATTERN, { message: "closesAt must be HH:mm" })
  closesAt?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  isClosed!: boolean;
}

export class SetBranchHoursDto {
  @ApiProperty({ type: [BranchHoursDayDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchHoursDayDto)
  days!: BranchHoursDayDto[];
}

export class BranchHoursResponseDto extends BranchHoursDayDto {
  @ApiProperty()
  id!: string;
}
