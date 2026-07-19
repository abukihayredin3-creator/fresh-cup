import { ApiPropertyOptional } from "@nestjs/swagger";
import { AiMemoryKind } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class MemoryEntryQueryDto {
  @ApiPropertyOptional({ description: "e.g. 'executive', 'sales-ai', 'kitchen-ai'" })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ enum: AiMemoryKind })
  @IsOptional()
  @IsEnum(AiMemoryKind)
  kind?: AiMemoryKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
