import { PartialType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { ShiftStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";
import { CreateShiftDto } from "./create-shift.dto";

export class UpdateShiftDto extends PartialType(CreateShiftDto) {
  @ApiPropertyOptional({ enum: ShiftStatus })
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;
}
