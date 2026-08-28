"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "./data";
import { useCart } from "@/features/cart/cart-provider";
import { formatTwd } from "@/lib/money";
import { toAnalyticsItem, trackEvent } from "@/lib/analytics";
import styles from "./product-purchase-panel.module.css";

type ProductVariantAvailability = "in_stock" | "preorder" | "unavailable";

export function ProductPurchasePanel({ product }: { product: Product }) {
  const optionGroups = product.optionGroups?.length
    ? product.optionGroups
    : [
      { name: "顏色", values: product.colors },
      { name: "尺寸", values: product.sizes },
    ].filter((group) => group.values.length);
  const [selections, setSelections] = useState<Record<string, string>>(
    Object.fromEntries(optionGroups.map((group) => [group.name, group.values[0]])),
  );
  const [added, setAdded] = useState(false);
  const [liveStatus, setLiveStatus] = useState<{ variantId: string; availability: ProductVariantAvailability; price: number; arrival?: string } | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const requestRef = useRef<{ variantId: string; controller: AbortController } | null>(null);
  const { addItem } = useCart();
  const router = useRouter();
  const selectedVariant = product.variants?.find((variant) =>
    Object.entries(selections).every(([name, value]) => variant.options[name] === value),
  );
  const selectedVariantId = selectedVariant?.id;
  const selectionInvalid = Boolean(product.variants?.length) && !selectedVariant;
  const color = Object.entries(selections).find(([name]) => ["顏色", "color", "colour", "色系"].includes(name.toLowerCase()))?.[1] ?? Object.values(selections)[0] ?? "";
  const size = Object.entries(selections).find(([name]) => ["尺寸", "size", "尺碼"].includes(name.toLowerCase()))?.[1] ?? Object.values(selections)[1] ?? "";
  const availability = selectedVariantId && liveStatus?.variantId === selectedVariantId
    ? liveStatus.availability
    : selectedVariant?.availability ?? (product.availability === "mixed" ? "in_stock" : product.availability);
  const price = selectedVariantId && liveStatus?.variantId === selectedVariantId ? liveStatus.price : selectedVariant?.price ?? product.price;
  const arrival = selectedVariantId && liveStatus?.variantId === selectedVariantId ? liveStatus.arrival : selectedVariant?.arrival ?? product.arrival;
  const unavailable = selectionInvalid || (selectedVariant ? availability === "unavailable" : !product.isAvailable);
  const syncing = Boolean(selectedVariantId) && (syncState === "idle" || syncState === "checking");
  const cannotPurchase = unavailable || syncing;

  const syncVariantAvailability = useCallback(async (variantId: string, fallbackPrice: number) => {
    const activeRequest = requestRef.current;
    if (activeRequest?.variantId === variantId) return;
    activeRequest?.controller.abort();
    const controller = new AbortController();
    requestRef.current = { variantId, controller };
    setSyncState("checking");
    try {
      const response = await fetch("/api/cart/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantIds: [variantId] }),
        cache: "no-store",
        signal: controller.signal,
      });
      const result = await response.json() as { statuses?: Array<{ variantId?: string; price?: number; availability?: ProductVariantAvailability; arrival?: string }> };
      if (!response.ok || !Array.isArray(result.statuses)) throw new Error("availability check failed");
      const status = result.statuses.find((item) => item.variantId === variantId);
      if (requestRef.current?.controller !== controller) return;
      if (!status || typeof status.price !== "number" || !status.availability) {
        setLiveStatus({ variantId, price: fallbackPrice, availability: "unavailable" });
      } else {
        setLiveStatus({ variantId, price: status.price, availability: status.availability, arrival: status.arrival });
      }
      setSyncState("ready");
    } catch (error) {
      if (controller.signal.aborted || requestRef.current?.controller !== controller) return;
      console.warn("[product] live availability check failed", error);
      setSyncState("error");
    } finally {
      if (requestRef.current?.controller === controller) requestRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!selectedVariantId) {
      requestRef.current?.controller.abort();
      requestRef.current = null;
      return;
    }
    const initialSync = window.setTimeout(() => {
      void syncVariantAvailability(selectedVariantId, selectedVariant?.price ?? product.price);
    }, 0);
    return () => {
      window.clearTimeout(initialSync);
      requestRef.current?.controller.abort();
      requestRef.current = null;
    };
  }, [product.price, selectedVariant?.price, selectedVariantId, syncVariantAvailability]);

  useEffect(() => {
    if (!selectedVariantId) return;
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void syncVariantAvailability(selectedVariantId, selectedVariant?.price ?? product.price);
    };
    window.addEventListener("focus", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.removeEventListener("focus", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [product.price, selectedVariant?.price, selectedVariantId, syncVariantAvailability]);

  useEffect(() => {
    if (!selectedVariantId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncVariantAvailability(selectedVariantId, selectedVariant?.price ?? product.price);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [product.price, selectedVariant?.price, selectedVariantId, syncVariantAvailability]);

  useEffect(() => {
    trackEvent("view_item", { currency: "TWD", value: price, items: [toAnalyticsItem({ id: product.id, name: product.name, price, variant: selectedVariant?.id })] });
  }, [price, product.id, product.name, selectedVariant?.id]);

  function addToCart() {
    if (unavailable) return;
    addItem({ variantKey: selectedVariant?.id ?? `${product.id}:${JSON.stringify(selections)}`, variantId: selectedVariant?.id, productId: product.id, slug: product.slug, name: product.name, color, size, quantity: 1, price, availability: availability === "preorder" ? "preorder" : "in_stock", arrival, palette: product.palette, image: product.images?.[0], selectedOptions: selections });
    trackEvent("add_to_cart", { currency: "TWD", value: price, items: [toAnalyticsItem({ id: product.id, name: product.name, price, variant: selectedVariant?.id })] });
    setAdded(true);
  }

  function buyNow() {
    if (unavailable) return;
    addToCart();
    router.push("/checkout");
  }

  return <div className={styles.panel}>
    {optionGroups.map((group) => <fieldset key={group.name}><legend>{group.name}：<strong>{selections[group.name]}</strong></legend><div className={styles.options}>{group.values.map((item) => <button className={selections[group.name] === item ? styles.selected : ""} type="button" key={item} aria-pressed={selections[group.name] === item} onClick={() => { setSelections((current) => ({ ...current, [group.name]: item })); setLiveStatus(null); setSyncState("idle"); setAdded(false); }}>{item}</button>)}</div></fieldset>)}
    <p className={styles.stock} aria-live="polite">{syncing ? "正在同步此規格的庫存…" : selectionInvalid ? "此規格目前無法購買，請重新選擇" : unavailable ? "此規格目前售罄" : availability === "preorder" ? `預購｜預計 ${arrival ?? "確認中"} 到貨` : `${Object.values(selections).join("／")} · 庫存會在結帳時再次確認`}</p>
    {syncState === "error" && <p className={styles.syncWarning} role="status">目前無法即時同步庫存；加入後仍會由伺服器再次驗證。</p>}
    <div className={styles.actions}><button className="button button-primary" type="button" onClick={addToCart} disabled={cannotPurchase}>{added ? "已加入購物車 ✓" : "加入購物車"}</button><button className="button button-secondary" type="button" onClick={buyNow} disabled={cannotPurchase}>立即購買</button></div>
    <p className={styles.demo}>價格、規格與庫存會在商品載入、切換規格及結帳時再次驗證。</p>
    <div className={styles.mobileSticky}><div><span>目前選擇</span><strong>{formatTwd(price)}</strong></div><button className="button button-primary" type="button" onClick={addToCart} disabled={cannotPurchase}>{added ? "已加入 ✓" : "加入購物車"}</button></div>
  </div>;
}
