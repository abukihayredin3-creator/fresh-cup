import { ApiProperty } from "@nestjs/swagger";
import { ApprovalActionType } from "@prisma/client";
import { IsEnum, IsObject } from "class-validator";

export class EvaluatePolicyDto {
  @ApiProperty({ enum: ApprovalActionType })
  @IsEnum(ApprovalActionType)
  actionType!: ApprovalActionType;

  @ApiProperty()
  @IsObject()
  payload!: Record<string, unknown>;
}
