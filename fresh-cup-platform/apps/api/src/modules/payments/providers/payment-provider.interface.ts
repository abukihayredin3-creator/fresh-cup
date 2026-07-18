import type { PaymentMethod, PaymentStatus } from "@prisma/client";

export const PAYMENT_PROVIDER_CHAPA = Symbol("PAYMENT_PROVIDER_CHAPA");
export const PAYMENT_PROVIDER_CASH = Symbol("PAYMENT_PROVIDER_CASH");

export interface PaymentInitiationRequest {
  paymentId: string;
  orderId: string;
  /** ETB minor units */
  amount: number;
  currency: string;
  method: PaymentMethod;
  customerEmail: string | null;
  customerName: string;
  customerPhone: string | null;
}

export interface PaymentInitiationResult {
  status: typeof PaymentStatus.INITIATED;
  providerReference: string;
  /** null for providers with no hosted checkout page (e.g. cash) */
  checkoutUrl: string | null;
}

/**
 * Dependency-inverted payment integration, mirroring the SMS_PROVIDER
 * pattern from Phase 1: OrdersService/PaymentsService depend on this
 * interface, never on Chapa's or cash's implementation details.
 */
export interface PaymentProvider {
  initiate(request: PaymentInitiationRequest): Promise<PaymentInitiationResult>;
  refund(providerReference: string, amount: number): Promise<void>;
}
