import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class SubscribeDto {
  @ApiProperty({ example: "growth" })
  @IsString()
  @MinLength(1)
  planKey!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;
}
