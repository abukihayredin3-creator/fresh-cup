import { ApiProperty } from "@nestjs/swagger";
import { UserResponseDto } from "../../../users/dto/user-response.dto";

export class AuthTokensResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ description: "Access token lifetime in seconds" })
  expiresIn!: number;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}
