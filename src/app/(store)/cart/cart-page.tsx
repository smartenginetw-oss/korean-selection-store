"use client";

import Link from "next/link";
import { ProductVisual } from "@/components/product-visual";
import { useCart } from "@/features/cart/cart-provider";
import { formatTwd } from "@/lib/money";
import styles from "./cart.module.css";

export default function CartPage({ shippingFee }: { shippingFee: number }) {
  const { items, updateQuantity, removeItem, availabilityStatus } = useCart();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = items.length ? shippingFee : 0;
  const unavailableCount = items.filter((item) => item.availability === "unavailable").length;
  const priceChangedCount = items.filter((item) => item.priceChanged).length;
  const missingVariantCount = items.filter((item) => !item.variantId).length;
  const checkoutBlocked = availabilityStatus === "checking" || unavailableCount > 0 || priceChangedCount > 0 || missingVariantCount > 0;

  if (!items.length) {
    return <div className={`container ${styles.empty}`}><div className="eyebrow">Your bag</div><h1 className="serif">購物車是空的</h1><p className="muted">慢慢逛，找到真正想帶回家的那一件。</p><Link className="button button-primary" href="/products">繼續逛逛</Link></div>;
  }

  return <div className={`container ${styles.page}`}><div><div className="eyebrow">Your bag</div><h1 className="serif">購物車（{items.length}）</h1><div className={styles.items}>{items.map((item) => <article key={item.variantKey} className={styles.item}><div className={styles.visual}><ProductVisual palette={item.palette} images={item.image ? [item.image] : []} label={item.name} /></div><div className={styles.itemInfo}><div><Link href={`/products/${item.slug}`}><strong>{item.name}</strong></Link><p>{Object.values(item.selectedOptions ?? { 顏色: item.color, 尺寸: item.size }).join("／")}</p><span className={`badge ${item.availability === "unavailable" ? "badge-sold" : item.availability === "preorder" ? "badge-preorder" : "badge-stock"}`}>{item.availability === "unavailable" ? "售罄" : item.availability === "preorder" ? `預購 ${item.arrival ?? ""}` : "現貨"}</span>{item.priceChanged && <small className={styles.itemWarning}>價格已更新，請回商品頁確認。</small>}</div><strong>{formatTwd(item.price)}</strong><div className={styles.itemActions}><div className={styles.stepper}><button type="button" aria-label="減少數量" onClick={() => updateQuantity(item.variantKey, item.quantity - 1)}>−</button><span>{item.quantity}</span><button type="button" aria-label="增加數量" onClick={() => updateQuantity(item.variantKey, item.quantity + 1)}>＋</button></div><button className={styles.remove} type="button" onClick={() => removeItem(item.variantKey)}>移除</button></div></div></article>)}</div></div><aside className={styles.summary}><h2 className="serif">訂單摘要</h2>{availabilityStatus === "checking" && <p className={styles.notice}>正在同步商品狀態，請稍候再結帳。</p>}{availabilityStatus === "error" && <p className={styles.notice}>商品狀態暫時無法同步；結帳時仍會由伺服器再次驗證。</p>}{unavailableCount > 0 && <p className={styles.notice}>購物車內有 {unavailableCount} 項商品已售罄，請先移除後再結帳。</p>}{priceChangedCount > 0 && <p className={styles.notice}>購物車內有 {priceChangedCount} 項商品價格已更新，請回商品頁重新加入。</p>}{missingVariantCount > 0 && <p className={styles.notice}>部分商品規格已失效，請回商品頁重新選擇。</p>}{items.some((item) => item.availability === "preorder") && <p className={styles.notice}>訂單含預購商品，將於商品到齊後一次出貨。</p>}<div><span>商品小計</span><strong>{formatTwd(subtotal)}</strong></div><div><span>預估宅配運費</span><strong>{formatTwd(shipping)}</strong></div><div className={styles.total}><span>預估總計</span><strong>{formatTwd(subtotal + shipping)}</strong></div>{checkoutBlocked ? <button className="button button-primary" type="button" disabled>請先更新購物車</button> : <Link className="button button-primary" href="/checkout">前往結帳</Link>}<small>結帳時可選擇宅配、7-ELEVEN 或全家；Server 會重新驗證實際運費與庫存。</small></aside></div>;
}
