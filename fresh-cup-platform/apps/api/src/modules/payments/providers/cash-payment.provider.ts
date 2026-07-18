import { Injectable } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import type {
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentProvider,
} from "./payment-provider.interface";

/** Pay-at-counter/pay-on-delivery — no external call, staff confirm receipt manually. */
@Injectable()
export class CashPaymentProvider implements PaymentProvider {
  initiate(request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    return Promise.resolve({
      status: PaymentStatus.INITIATED,
      providerReference: `cash-${request.orderId}`,
      checkoutUrl: null,
    });
  }

  refund(): Promise<void> {
    // Cash refunds happen physically at the counter; nothing to call out to.
    return Promise.resolve();
  }
}
