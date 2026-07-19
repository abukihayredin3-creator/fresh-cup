import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsPositive, IsUUID } from "class-validator";

export class CreateReferralCodeDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: "Reward in ETB minor units, credited on a successful redemption" })
  @IsInt()
  @IsPositive()
  rewardAmount!: number;
}
