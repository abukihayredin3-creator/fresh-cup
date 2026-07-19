import type { LoyaltyReason } from "./enums";

export interface LoyaltyLedgerEntry {
  id: string;
  pointsDelta: number;
  reason: LoyaltyReason;
  balanceAfter: number;
  orderId: string | null;
  createdAt: string;
}

export interface LoyaltyMe {
  balance: number;
  history: LoyaltyLedgerEntry[];
  nextCursor: string | null;
}
