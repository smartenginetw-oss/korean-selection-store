"use client";

import { useCart, type CartItem } from "./cart-provider";

export function ReorderButton({ item }: { item: CartItem }) {
  const { addItem } = useCart();
  return <button className="button button-secondary button-small" type="button" onClick={() => addItem(item)}>再次購買</button>;
}
