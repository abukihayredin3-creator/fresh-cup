import { ApiProperty } from "@nestjs/swagger";
import { PushPlatform } from "@prisma/client";
import { IsEnum, IsString, MinLength } from "class-validator";

export class RegisterPushTokenDto {
  @ApiProperty({ description: "FCM/APNs device token" })
  @IsString()
  @MinLength(10)
  token!: string;

  @ApiProperty({ enum: PushPlatform })
  @IsEnum(PushPlatform)
  platform!: PushPlatform;
}
