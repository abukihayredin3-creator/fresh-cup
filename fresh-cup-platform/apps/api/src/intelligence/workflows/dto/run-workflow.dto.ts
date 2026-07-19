import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class RunWorkflowDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;
}
