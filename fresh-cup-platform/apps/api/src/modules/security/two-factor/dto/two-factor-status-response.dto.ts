import { ApiProperty } from "@nestjs/swagger";

export class TwoFactorStatusResponseDto {
  @ApiProperty()
  enabled!: boolean;
}

export class TwoFactorEnrollResponseDto {
  @ApiProperty({ description: "Base32 secret — for manual entry if the QR code can't be scanned" })
  secret!: string;

  @ApiProperty({ description: "otpauth:// URL — render this as a QR code" })
  otpauthUrl!: string;
}
