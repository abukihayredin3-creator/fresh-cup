import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ClockInDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;
}
