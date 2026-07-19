import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { AttachInvoiceDto } from "./dto/attach-invoice.dto";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { CreatePurchaseOrderPaymentDto } from "./dto/create-purchase-order-payment.dto";
import { ListPurchaseOrdersQueryDto } from "./dto/list-purchase-orders-query.dto";
import { PurchaseOrderResponseDto } from "./dto/purchase-order-response.dto";
import { ReceivePurchaseOrderDto } from "./dto/receive-purchase-order.dto";
import { PurchaseOrdersService } from "./purchase-orders.service";

@ApiTags("purchasing")
@Controller("admin/purchase-orders")
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("PurchaseOrder")
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @ApiOperation({ summary: "List purchase orders (staff+, branch-scoped for managers)" })
  async list(@CurrentUser() actor: RequestUser, @Query() query: ListPurchaseOrdersQueryDto) {
    const page = await this.purchaseOrdersService.list(actor, query);
    return { ...page, items: page.items.map((o) => this.purchaseOrdersService.toResponse(o)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a purchase order by id (staff+)" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async get(@Param("id") id: string): Promise<PurchaseOrderResponseDto> {
    const order = await this.purchaseOrdersService.findByIdOrThrow(id);
    return this.purchaseOrdersService.toResponse(order);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create a draft purchase order (manager/admin)" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrderResponseDto> {
    const created = await this.purchaseOrdersService.create(actor, dto);
    return this.purchaseOrdersService.toResponse(created);
  }

  @Post(":id/submit")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Submit a draft purchase order to its supplier (manager/admin)" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async submit(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
  ): Promise<PurchaseOrderResponseDto> {
    const updated = await this.purchaseOrdersService.submit(actor, id);
    return this.purchaseOrdersService.toResponse(updated);
  }

  @Post(":id/receive")
  @ApiOperation({ summary: "Receive a submitted purchase order and restock inventory (staff+)" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async receive(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ): Promise<PurchaseOrderResponseDto> {
    const updated = await this.purchaseOrdersService.receive(actor, id, dto);
    return this.purchaseOrdersService.toResponse(updated);
  }

  @Post(":id/cancel")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Cancel a draft or submitted purchase order (manager/admin)" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async cancel(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
  ): Promise<PurchaseOrderResponseDto> {
    const updated = await this.purchaseOrdersService.cancel(actor, id);
    return this.purchaseOrdersService.toResponse(updated);
  }

  @Patch(":id/invoice")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Attach an invoice reference to a purchase order (manager/admin)" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async attachInvoice(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: AttachInvoiceDto,
  ): Promise<PurchaseOrderResponseDto> {
    const updated = await this.purchaseOrdersService.attachInvoice(actor, id, dto);
    return this.purchaseOrdersService.toResponse(updated);
  }

  @Post(":id/payments")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Record a payment against a purchase order (manager/admin)" })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async addPayment(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: CreatePurchaseOrderPaymentDto,
  ): Promise<PurchaseOrderResponseDto> {
    const updated = await this.purchaseOrdersService.addPayment(actor, id, dto);
    return this.purchaseOrdersService.toResponse(updated);
  }
}
