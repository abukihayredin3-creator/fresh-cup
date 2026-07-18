import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentStatus } from "@prisma/client";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import { generateOpaqueToken } from "../../../common/crypto/token.util";
import type {
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentProvider,
} from "./payment-provider.interface";

interface ChapaInitializeResponse {
  status: string;
  message?: string;
  data?: { checkout_url: string };
}

/**
 * Chapa is Ethiopia's standard payment aggregator — one integration covers
 * TeleBirr, CBE Birr, HelloCash, Amole, and cards (see docs/ARCHITECTURE.md
 * for why a direct TeleBirr integration was rejected in favor of this).
 *
 * With no CHAPA_SECRET_KEY configured (local dev/test/CI), this falls back
 * to a fabricated checkout reference instead of calling the real API — the
 * same "sandbox" pattern Phase 1 used for the console SMS provider.
 */
@Injectable()
export class ChapaPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(ChapaPaymentProvider.name);

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  async initiate(request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    const txRef = `fc-${request.orderId}-${generateOpaqueToken().slice(0, 12)}`;
    const secretKey = this.config.get("CHAPA_SECRET_KEY", { infer: true });

    if (!secretKey) {
      this.logger.warn("CHAPA_SECRET_KEY not set — fabricating a sandbox checkout reference");
      return {
        status: PaymentStatus.INITIATED,
        providerReference: txRef,
        checkoutUrl: `https://checkout.chapa.co/sandbox/${txRef}`,
      };
    }

    const [firstName, ...rest] = request.customerName.trim().split(/\s+/);
    const baseUrl = this.config.get("CHAPA_BASE_URL", { infer: true });

    const response = await fetch(`${baseUrl}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: (request.amount / 100).toFixed(2),
        currency: request.currency,
        email: request.customerEmail ?? `guest+${request.orderId}@freshcup.et`,
        first_name: firstName || "Fresh",
        last_name: rest.join(" ") || "Cup Customer",
        phone_number: request.customerPhone ?? undefined,
        tx_ref: txRef,
        callback_url: this.config.get("CHAPA_CALLBACK_URL", { infer: true }),
        return_url: this.config.get("CHAPA_RETURN_URL", { infer: true }),
        customization: { title: "Fresh Cup", description: "Order payment" },
      }),
    });

    const body = (await response.json()) as ChapaInitializeResponse;
    if (!response.ok || body.status !== "success" || !body.data) {
      throw new BadGatewayException(
        `Chapa payment initiation failed: ${body.message ?? response.statusText}`,
      );
    }

    return {
      status: PaymentStatus.INITIATED,
      providerReference: txRef,
      checkoutUrl: body.data.checkout_url,
    };
  }

  async refund(providerReference: string, amount: number): Promise<void> {
    const secretKey = this.config.get("CHAPA_SECRET_KEY", { infer: true });
    if (!secretKey) {
      this.logger.warn(`Sandbox mode — pretending to refund ${providerReference}`);
      return;
    }

    const baseUrl = this.config.get("CHAPA_BASE_URL", { infer: true });
    const response = await fetch(`${baseUrl}/refund/${providerReference}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: (amount / 100).toFixed(2) }),
    });

    if (!response.ok) {
      throw new BadGatewayException(`Chapa refund failed: ${response.statusText}`);
    }
  }
}
