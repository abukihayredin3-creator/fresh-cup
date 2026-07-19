import type { AddCartItemInput, Cart } from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { api } from "./api-client";
import { useAuth } from "./auth-context";
import { useBranch } from "./branch-context";

interface CartContextValue {
  cart: Cart | undefined;
  isLoading: boolean;
  addItem: (input: Omit<AddCartItemInput, "branchId">) => Promise<Cart>;
  updateItem: (itemId: string, quantity: number) => Promise<Cart>;
  removeItem: (itemId: string) => Promise<Cart>;
  clear: () => Promise<void>;
  isMutating: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { branchId } = useBranch();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const cartQueryKey = useMemo(() => ["cart", branchId] as const, [branchId]);

  const { data: cart, isLoading } = useQuery({
    queryKey: cartQueryKey,
    queryFn: () => api.cart.get(branchId as string),
    enabled: Boolean(branchId) && Boolean(user),
  });

  const addMutation = useMutation({
    mutationFn: (input: Omit<AddCartItemInput, "branchId">) => {
      if (!branchId) throw new Error("No branch selected");
      return api.cart.addItem({ ...input, branchId });
    },
    onSuccess: (next) => queryClient.setQueryData(cartQueryKey, next),
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api.cart.updateItem(itemId, { quantity }),
    onSuccess: (next) => queryClient.setQueryData(cartQueryKey, next),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => api.cart.removeItem(itemId),
    onSuccess: (next) => queryClient.setQueryData(cartQueryKey, next),
  });

  const clearMutation = useMutation({
    mutationFn: () => {
      if (!branchId) throw new Error("No branch selected");
      return api.cart.clear(branchId);
    },
    onSuccess: () =>
      queryClient.setQueryData(cartQueryKey, {
        id: null,
        branchId,
        items: [],
        subtotal: 0,
        itemCount: 0,
      }),
  });

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      isLoading,
      addItem: (input) => addMutation.mutateAsync(input),
      updateItem: (itemId, quantity) => updateMutation.mutateAsync({ itemId, quantity }),
      removeItem: (itemId) => removeMutation.mutateAsync(itemId),
      clear: () => clearMutation.mutateAsync(),
      isMutating:
        addMutation.isPending ||
        updateMutation.isPending ||
        removeMutation.isPending ||
        clearMutation.isPending,
    }),
    [cart, isLoading, addMutation, updateMutation, removeMutation, clearMutation],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
