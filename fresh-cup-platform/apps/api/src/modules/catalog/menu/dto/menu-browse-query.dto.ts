import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class MenuBrowseQueryDto {
  @ApiPropertyOptional({
    description: "Restrict to a single branch; omit to use the platform's first active branch",
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
