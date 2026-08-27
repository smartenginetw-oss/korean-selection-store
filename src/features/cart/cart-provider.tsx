"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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
  availability: "in_stock" | "preorder" | "unavailable";
  arrival?: string;
  palette: [string, string];
  image?: string;
  selectedOptions?: Record<string, string>;
  priceChanged?: boolean;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (variantKey: string, quantity: number) => void;
  removeItem: (variantKey: string) => void;
  clearCart: () => void;
  refreshAvailability: () => Promise<void>;
  availabilityStatus: "idle" | "checking" | "ready" | "error";
};

const STORAGE_KEY = "gyeot-cart-v1";
const LEGACY_STORAGE_KEY = "morii-demo-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<CartContextValue["availabilityStatus"]>("idle");
  const itemsRef = useRef(items);
  const requestSequence = useRef(0);
  const inFlightSignature = useRef<string | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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

  const refreshAvailability = useCallback(async () => {
    const currentItems = itemsRef.current;
    const variantIds = [...new Set(currentItems.map((item) => item.variantId).filter((id): id is string => Boolean(id)))].sort();
    if (!variantIds.length) {
      setAvailabilityStatus("ready");
      return;
    }
    const signature = variantIds.join(",");
    if (inFlightSignature.current === signature) return;
    inFlightSignature.current = signature;
    const sequence = ++requestSequence.current;
    setAvailabilityStatus("checking");
    try {
      const response = await fetch("/api/cart/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantIds }),
        cache: "no-store",
      });
      const result = await response.json() as {
        statuses?: Array<{ variantId?: string; price?: number; availability?: CartItem["availability"]; arrival?: string }>;
      };
      if (!response.ok || !Array.isArray(result.statuses)) throw new Error("availability check failed");
      if (sequence !== requestSequence.current) return;
      const statusByVariant = new Map(result.statuses.filter((status): status is { variantId: string; price?: number; availability?: CartItem["availability"]; arrival?: string } => typeof status.variantId === "string").map((status) => [status.variantId, status]));
      setItems((current) => current.map((item) => {
        if (!item.variantId) return item;
        const status = statusByVariant.get(item.variantId);
        if (!status) return { ...item, availability: "unavailable", priceChanged: undefined };
        const availability = status.availability === "preorder" || status.availability === "unavailable" ? status.availability : "in_stock";
        const priceChanged = typeof status.price === "number" && status.price !== item.price;
        return { ...item, availability, arrival: status.arrival, priceChanged: priceChanged || undefined };
      }));
      setAvailabilityStatus("ready");
    } catch {
      if (sequence === requestSequence.current) setAvailabilityStatus("error");
    } finally {
      if (inFlightSignature.current === signature) inFlightSignature.current = null;
    }
  }, []);

  const variantSignature = useMemo(() => [...new Set(items.map((item) => item.variantId).filter(Boolean))].sort().join(","), [items]);

  useEffect(() => {
    if (!storageReady || !variantSignature) return;
    void refreshAvailability();
  }, [refreshAvailability, storageReady, variantSignature]);

  useEffect(() => {
    if (!storageReady) return;
    const handleFocus = () => {
      if (document.visibilityState === "visible") void refreshAvailability();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [refreshAvailability, storageReady]);

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
  const value = useMemo(() => ({ items, count, addItem, updateQuantity, removeItem, clearCart, refreshAvailability, availabilityStatus }), [items, count, addItem, updateQuantity, removeItem, clearCart, refreshAvailability, availabilityStatus]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
