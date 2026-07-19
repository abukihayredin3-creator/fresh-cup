import { BadRequestException, Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ApprovalActionType } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import { CampaignsService } from "../../modules/marketing/campaigns/campaigns.service";
import { CreateCampaignDto } from "../../modules/marketing/campaigns/dto/create-campaign.dto";
import { MenuItemsService } from "../../modules/catalog/menu-items/menu-items.service";
import { UpdateMenuItemDto } from "../../modules/catalog/menu-items/dto/update-menu-item.dto";
import { PaymentsService } from "../../modules/payments/payments.service";
import { CouponsService } from "../../modules/promotions/coupons/coupons.service";
import { CreateCouponDto } from "../../modules/promotions/coupons/dto/create-coupon.dto";
import { CreatePurchaseOrderDto } from "../../modules/purchasing/purchase-orders/dto/create-purchase-order.dto";
import { PurchaseOrdersService } from "../../modules/purchasing/purchase-orders/purchase-orders.service";

export interface ExecutionResult {
  executed: boolean;
  result?: unknown;
  note: string;
}

async function validateDto<T extends object>(cls: new () => T, payload: unknown): Promise<T> {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance, { whitelist: true });
  if (errors.length > 0) {
    throw new BadRequestException(
      `Approval payload failed validation for ${cls.name}: ${errors.map((e) => e.property).join(", ")}`,
    );
  }
  return instance;
}

/**
 * Executes an approved `AiApprovalRequest` — the ONLY place in Phase 11
 * Part 3 code that turns an AI-drafted action into a real write. Every
 * entry point (workflow engine, automation drafts, decision engine) stops
 * at creating a PENDING request; this registry only ever runs after a
 * human has called `POST /admin/ai/approvals/:id/approve`.
 *
 * Not every `ApprovalActionType` has an automatic executor — REFUND,
 * DELETE, and STAFFING_CHANGE targets vary too much (which payment? which
 * record? which shift?) to generalize safely, so approving one of those
 * just records the human decision; a manager still performs the action
 * through its existing screen. This is a deliberate scope boundary, not
 * an oversight — see docs/ROADMAP.md's Part 3 notes.
 */
@Injectable()
export class ApprovalExecutorRegistry {
  constructor(
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly coupons: CouponsService,
    private readonly campaigns: CampaignsService,
    private readonly menuItems: MenuItemsService,
    private readonly payments: PaymentsService,
  ) {}

  async execute(
    actionType: ApprovalActionType,
    payload: unknown,
    actor: RequestUser,
  ): Promise<ExecutionResult> {
    switch (actionType) {
      case ApprovalActionType.INVENTORY_PURCHASE_ORDER: {
        const dto = await validateDto(CreatePurchaseOrderDto, payload);
        const po = await this.purchaseOrders.create(actor, dto);
        return { executed: true, result: po, note: `Created purchase order ${po.id}.` };
      }
      case ApprovalActionType.DISCOUNT: {
        const dto = await validateDto(CreateCouponDto, payload);
        const coupon = await this.coupons.create(dto);
        return { executed: true, result: coupon, note: `Created coupon ${coupon.code}.` };
      }
      case ApprovalActionType.PROMOTION:
      case ApprovalActionType.MARKETING_CAMPAIGN: {
        const dto = await validateDto(CreateCampaignDto, payload);
        const campaign = await this.campaigns.create(actor, dto);
        return { executed: true, result: campaign, note: `Created campaign ${campaign.id}.` };
      }
      case ApprovalActionType.PRICE_CHANGE: {
        const { menuItemId, ...rest } = payload as { menuItemId?: string } & Record<
          string,
          unknown
        >;
        if (!menuItemId) {
          throw new BadRequestException("PRICE_CHANGE payload requires menuItemId");
        }
        const dto = await validateDto(UpdateMenuItemDto, rest);
        const item = await this.menuItems.update(actor, menuItemId, dto);
        return { executed: true, result: item, note: `Updated price for ${item.id}.` };
      }
      case ApprovalActionType.REFUND: {
        const { paymentId } = payload as { paymentId?: string };
        if (!paymentId) {
          throw new BadRequestException("REFUND payload requires paymentId");
        }
        const refunded = await this.payments.refund(paymentId);
        return { executed: true, result: refunded, note: `Refunded payment ${paymentId}.` };
      }
      case ApprovalActionType.DELETE:
      case ApprovalActionType.STAFFING_CHANGE:
      case ApprovalActionType.OTHER:
      default:
        return {
          executed: false,
          note: "Approval recorded — this action type has no automatic executor and must be carried out manually through its existing admin screen.",
        };
    }
  }
}
