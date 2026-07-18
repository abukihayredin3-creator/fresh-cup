import { ApiProperty } from "@nestjs/swagger";
import { LoyaltyLedgerEntryResponseDto } from "./loyalty-ledger-entry-response.dto";

export class LoyaltyMeResponseDto {
  @ApiProperty()
  balance!: number;

  @ApiProperty({ type: [LoyaltyLedgerEntryResponseDto] })
  history!: LoyaltyLedgerEntryResponseDto[];

  @ApiProperty({ nullable: true, description: "Opaque cursor for the next page of history" })
  nextCursor!: string | null;
}
