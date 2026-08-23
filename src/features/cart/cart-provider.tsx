"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  variantKey: string;
  variantId?: string;
  productId: string;
  slug: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  availability: "in_stock" | "preorder";
  arrival?: string;
  palette: [string, string];
  selectedOptions?: Record<string, string>;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (variantKey: string, quantity: number) => void;
  removeItem: (variantKey: string) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "gyeot-cart-v1";
const LEGACY_STORAGE_KEY = "morii-demo-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (saved) setItems(JSON.parse(saved) as CartItem[]);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        setStorageReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, storageReady]);

  const addItem = useCallback((item: CartItem) => {
    setItems((current) => {
      const existing = current.find((entry) => entry.variantKey === item.variantKey);
      if (!existing) return [...current, item];
      return current.map((entry) => entry.variantKey === item.variantKey
        ? { ...entry, quantity: Math.min(10, entry.quantity + item.quantity) }
        : entry);
    });
  }, []);

  const updateQuantity = useCallback((variantKey: string, quantity: number) => {
    setItems((current) => current.map((item) => item.variantKey === variantKey
      ? { ...item, quantity: Math.max(1, Math.min(10, quantity)) }
      : item));
  }, []);

  const removeItem = useCallback((variantKey: string) => {
    setItems((current) => current.filter((item) => item.variantKey !== variantKey));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const value = useMemo(() => ({ items, count, addItem, updateQuantity, removeItem, clearCart }), [items, count, addItem, updateQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
