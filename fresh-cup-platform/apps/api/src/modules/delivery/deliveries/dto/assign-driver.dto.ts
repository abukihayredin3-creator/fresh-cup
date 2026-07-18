import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AssignDriverDto {
  @ApiProperty()
  @IsUUID()
  driverId!: string;
}
