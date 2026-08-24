"use client";

import { useState } from "react";
import type { Product } from "./data";
import { useCart } from "@/features/cart/cart-provider";
import { formatTwd } from "@/lib/money";
import styles from "./product-purchase-panel.module.css";

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
  const { addItem } = useCart();
  const selectedVariant = product.variants?.find((variant) =>
    Object.entries(selections).every(([name, value]) => variant.options[name] === value),
  );
  const color = Object.entries(selections).find(([name]) => ["顏色", "color", "colour", "色系"].includes(name.toLowerCase()))?.[1] ?? Object.values(selections)[0] ?? "";
  const size = Object.entries(selections).find(([name]) => ["尺寸", "size", "尺碼"].includes(name.toLowerCase()))?.[1] ?? Object.values(selections)[1] ?? "";
  const availability = selectedVariant?.availability ?? product.availability;
  const price = selectedVariant?.price ?? product.price;
  const unavailable = availability === "unavailable";

  function addToCart() {
    if (unavailable) return;
    addItem({ variantKey: selectedVariant?.id ?? `${product.id}:${JSON.stringify(selections)}`, variantId: selectedVariant?.id, productId: product.id, slug: product.slug, name: product.name, color, size, quantity: 1, price, availability: availability === "preorder" ? "preorder" : "in_stock", arrival: selectedVariant?.arrival ?? product.arrival, palette: product.palette, image: product.images?.[0], selectedOptions: selections });
    setAdded(true);
  }

  return <div className={styles.panel}>
    {optionGroups.map((group) => <fieldset key={group.name}><legend>{group.name}：<strong>{selections[group.name]}</strong></legend><div className={styles.options}>{group.values.map((item) => <button className={selections[group.name] === item ? styles.selected : ""} type="button" key={item} aria-pressed={selections[group.name] === item} onClick={() => { setSelections((current) => ({ ...current, [group.name]: item })); setAdded(false); }}>{item}</button>)}</div></fieldset>)}
    <p className={styles.stock}>{unavailable ? "此規格暫時無法購買" : availability === "preorder" ? `預購｜預計 ${selectedVariant?.arrival ?? product.arrival ?? "確認中"} 到貨` : `${Object.values(selections).join("／")} · Server 結帳時確認庫存`}</p>
    <div className={styles.actions}><button className="button button-primary" type="button" onClick={addToCart} disabled={unavailable}>{added ? "已加入購物車 ✓" : "加入購物車"}</button><button className="button button-secondary" type="button" onClick={addToCart} disabled={unavailable}>立即購買</button></div>
    <p className={styles.demo}>價格、規格與庫存會在 Server checkout 再次驗證。</p>
    <div className={styles.mobileSticky}><div><span>目前選擇</span><strong>{formatTwd(price)}</strong></div><button className="button button-primary" type="button" onClick={addToCart} disabled={unavailable}>{added ? "已加入 ✓" : "加入購物車"}</button></div>
  </div>;
}
