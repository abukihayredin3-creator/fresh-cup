export interface CartItemModifier {
  modifierOptionId: string;
  nameEn: string;
  priceDelta: number;
}

export interface CartItem {
  id: string;
  menuItemId: string;
  nameEn: string;
  quantity: number;
  notes: string | null;
  /** Base price + selected modifiers, ETB minor units. */
  unitPrice: number;
  /** unitPrice * quantity. */
  lineTotal: number;
  modifiers: CartItemModifier[];
}

export interface Cart {
  /** null until the first item is added. */
  id: string | null;
  branchId: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export interface AddCartItemInput {
  branchId: string;
  menuItemId: string;
  quantity?: number;
  notes?: string;
  modifierOptionIds?: string[];
}

export interface UpdateCartItemInput {
  quantity: number;
}
