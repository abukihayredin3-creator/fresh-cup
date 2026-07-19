import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ApprovalActionType, ApprovalRiskLevel } from "@prisma/client";
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateApprovalRequestDto {
  @ApiProperty({ enum: ApprovalActionType })
  @IsEnum(ApprovalActionType)
  actionType!: ApprovalActionType;

  @ApiProperty({ enum: ApprovalRiskLevel })
  @IsEnum(ApprovalRiskLevel)
  riskLevel!: ApprovalRiskLevel;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  summary!: string;

  @ApiProperty({ description: "Executor-specific payload — shape depends on actionType" })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
