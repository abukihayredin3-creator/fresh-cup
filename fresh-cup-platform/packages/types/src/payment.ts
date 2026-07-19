import type { PaymentMethod, PaymentProvider, PaymentStatus } from "./enums";

export interface Payment {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  method: PaymentMethod;
  providerReference: string | null;
  /** ETB minor units. */
  amount: number;
  currency: string;
  status: PaymentStatus;
  initiatedAt: string;
  completedAt: string | null;
}

export interface InitiatePaymentInput {
  orderId: string;
  method: PaymentMethod;
}

export interface InitiatePaymentResult extends Payment {
  /** Hosted checkout URL (Chapa only). */
  checkoutUrl: string | null;
}
