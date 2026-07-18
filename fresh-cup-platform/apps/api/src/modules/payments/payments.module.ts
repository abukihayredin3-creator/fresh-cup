import { Module } from "@nestjs/common";
import { OrderingModule } from "../ordering/ordering.module";
import { UsersModule } from "../users/users.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { CashPaymentProvider } from "./providers/cash-payment.provider";
import { ChapaPaymentProvider } from "./providers/chapa-payment.provider";
import {
  PAYMENT_PROVIDER_CASH,
  PAYMENT_PROVIDER_CHAPA,
} from "./providers/payment-provider.interface";

@Module({
  imports: [OrderingModule, UsersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    ChapaPaymentProvider,
    CashPaymentProvider,
    { provide: PAYMENT_PROVIDER_CHAPA, useExisting: ChapaPaymentProvider },
    { provide: PAYMENT_PROVIDER_CASH, useExisting: CashPaymentProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
