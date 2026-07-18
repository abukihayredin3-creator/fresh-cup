import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CartService } from "./cart.service";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { CartQueryDto } from "./dto/cart-query.dto";
import { CartResponseDto } from "./dto/cart-response.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

@ApiTags("cart")
@ApiBearerAuth()
@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get the current user's cart for a branch" })
  @ApiOkResponse({ type: CartResponseDto })
  getCart(
    @CurrentUser() actor: RequestUser,
    @Query() query: CartQueryDto,
  ): Promise<CartResponseDto> {
    return this.cartService.getCart(actor.id, query.branchId);
  }

  @Post("items")
  @ApiOperation({ summary: "Add an item to the cart (merges with an identical existing line)" })
  @ApiOkResponse({ type: CartResponseDto })
  addItem(
    @CurrentUser() actor: RequestUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.addItem(actor.id, dto);
  }

  @Patch("items/:itemId")
  @ApiOperation({ summary: "Update a cart item's quantity" })
  @ApiOkResponse({ type: CartResponseDto })
  updateItem(
    @CurrentUser() actor: RequestUser,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.updateItemQuantity(actor.id, itemId, dto.quantity);
  }

  @Delete("items/:itemId")
  @ApiOperation({ summary: "Remove an item from the cart" })
  @ApiOkResponse({ type: CartResponseDto })
  removeItem(
    @CurrentUser() actor: RequestUser,
    @Param("itemId") itemId: string,
  ): Promise<CartResponseDto> {
    return this.cartService.removeItem(actor.id, itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Clear the entire cart for a branch" })
  async clear(@CurrentUser() actor: RequestUser, @Query() query: CartQueryDto): Promise<void> {
    await this.cartService.clearCart(actor.id, query.branchId);
  }
}
