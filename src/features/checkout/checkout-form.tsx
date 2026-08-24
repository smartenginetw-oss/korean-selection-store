"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/features/cart/cart-provider";
import { TaiwanAddressFields } from "@/components/taiwan-address-fields";
import { formatTwd } from "@/lib/money";
import type { StoreSettings } from "@/lib/store-settings";
import styles from "./checkout-form.module.css";

type CheckoutPrefill = {
  displayName: string;
  email: string;
  phone: string;
  address?: {
    recipientName: string;
    phone: string;
    postalCode: string;
    city: string;
    district: string;
    addressLine: string;
  };
};

export function CheckoutForm({ settings, prefill }: { settings: Pick<StoreSettings, "shippingFee" | "reservationMinutes">; prefill?: CheckoutPrefill }) {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponPreview, setCouponPreview] = useState<{ couponCode: string; discountTotal: number; grandTotal: number } | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingTotal = items.length ? settings.shippingFee : 0;
  const total = subtotal - (couponPreview?.discountTotal ?? 0) + shippingTotal;

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) {
      setCouponPreview(null);
      setCouponStatus("error");
      setCouponMessage("請先輸入優惠碼。");
      return;
    }
    if (!items.length) return;
    if (items.some((item) => !item.variantId)) {
      setCouponStatus("error");
      setCouponMessage("商品規格尚未同步，請回到商品頁重新加入購物車。");
      return;
    }

    setCouponStatus("loading");
    setCouponMessage(null);
    try {
      const response = await fetch("/api/coupon-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ couponCode: code, items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })) }),
      });
      const result = await response.json() as { preview?: { couponCode?: string; discountTotal?: number; grandTotal?: number }; error?: { message?: string } };
      if (!response.ok || !result.preview || typeof result.preview.discountTotal !== "number" || typeof result.preview.grandTotal !== "number" || typeof result.preview.couponCode !== "string") {
        throw new Error(result.error?.message ?? "優惠碼無效、已過期或未達使用門檻。");
      }
      setCouponPreview({ couponCode: result.preview.couponCode, discountTotal: result.preview.discountTotal, grandTotal: result.preview.grandTotal });
      setCouponStatus("success");
      setCouponMessage(`已套用 ${result.preview.couponCode}，送出訂單時會再次驗證。`);
    } catch (previewError) {
      setCouponPreview(null);
      setCouponStatus("error");
      setCouponMessage(previewError instanceof Error ? previewError.message : "目前無法檢查優惠碼，請稍後再試。");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !items.length) return;
    const missingVariant = items.some((item) => !item.variantId);
    if (missingVariant) {
      setErrorMessage("商品規格尚未同步，請回到商品頁重新加入購物車。");
      return;
    }

    const formData = new FormData(event.currentTarget);
    idempotencyKey.current ??= `web-${crypto.randomUUID()}`;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          paymentProvider: formData.get("payment") ?? "test",
          shippingMethod: formData.get("shippingMethod") ?? "home_delivery",
          consentVersion: "terms-v1",
          couponCode: couponCode.trim() || undefined,
          customer: {
            email: formData.get("email"),
            phone: formData.get("phone"),
            recipientName: formData.get("recipient"),
            postalCode: formData.get("postalCode"),
            city: formData.get("city"),
            district: formData.get("district"),
            addressLine: formData.get("address"),
          },
          items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        }),
      });
      const result = await response.json() as { order?: { orderNumber?: string; grandTotal?: number; discountTotal?: number; couponCode?: string | null }; error?: { message?: string } };
      if (!response.ok || !result.order?.orderNumber) {
        if (response.status === 409) idempotencyKey.current = null;
        throw new Error(result.error?.message ?? "目前無法建立訂單，請稍後再試。");
      }

      const orderNumber = result.order.orderNumber;
      window.sessionStorage.setItem("morii-demo-order", JSON.stringify({ orderNumber, total: result.order.grandTotal ?? total, discountTotal: result.order.discountTotal ?? 0, couponCode: result.order.couponCode ?? null }));
      clearCart();
      router.push(`/checkout/result?order=${orderNumber}`);
    } catch (submitError) {
      setErrorMessage(submitError instanceof Error ? submitError.message : "目前無法建立訂單，請稍後再試。");
      setSubmitting(false);
    }
  }

  return <form className={styles.form} onSubmit={submit}>
    {errorMessage && <div className={styles.error} role="alert">{errorMessage}</div>}
    <div className={styles.sections}>
      <section><h2 className="serif">聯絡資料</h2>{prefill && <p className={styles.prefillNote}>已帶入會員資料，可在送出前修改。</p>}<div className={styles.fields}><div className="field"><label htmlFor="name">姓名</label><input className="input" id="name" name="name" autoComplete="name" required maxLength={80} defaultValue={prefill?.displayName} /></div><div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={prefill?.email} /></div><div className="field"><label htmlFor="phone">手機</label><input className="input" id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required pattern="09[0-9]{8}" placeholder="0912345678" defaultValue={prefill?.phone} /></div></div></section>
      <section><h2 className="serif">宅配地址</h2>{prefill?.address && <p className={styles.prefillNote}>已帶入你的預設地址，可在送出前修改。</p>}<div className={styles.fields}><div className="field"><label htmlFor="recipient">收件人</label><input className="input" id="recipient" name="recipient" required maxLength={80} defaultValue={prefill?.address?.recipientName || prefill?.displayName} /></div><TaiwanAddressFields className={styles.row} idPrefix="checkout" defaultCity={prefill?.address?.city} defaultDistrict={prefill?.address?.district} /><div className={styles.row}><div className="field"><label htmlFor="postalCode">郵遞區號</label><input className="input" id="postalCode" name="postalCode" inputMode="numeric" required minLength={3} maxLength={6} defaultValue={prefill?.address?.postalCode} /></div><div /></div><div className="field"><label htmlFor="address">地址</label><input className="input" id="address" name="address" autoComplete="street-address" required maxLength={160} defaultValue={prefill?.address?.addressLine} /></div></div></section>
      <section><h2 className="serif">配送方式</h2><div className="field"><label htmlFor="shippingMethod">選擇配送方式</label><select className="input" id="shippingMethod" name="shippingMethod" defaultValue="home_delivery" required><option value="home_delivery">宅配（台灣）</option></select><small className={styles.fieldHint}>V1 目前提供宅配；後續版本可擴充超商取貨等配送方式。</small></div></section>
      <section><h2 className="serif">付款方式</h2><label className={styles.payment}><input type="radio" name="payment" value="test" defaultChecked /><span><strong>測試付款</strong><small>Preview 專用，不會產生真實扣款</small></span></label></section>
      <section><h2 className="serif">優惠碼</h2><div className="field"><label htmlFor="couponCode">優惠碼（選填）</label><div className={styles.couponRow}><input className="input" id="couponCode" name="couponCode" value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setCouponPreview(null); setCouponStatus("idle"); setCouponMessage(null); }} maxLength={40} autoCapitalize="characters" placeholder="輸入優惠碼" /><button className="button button-secondary button-small" type="button" onClick={applyCoupon} disabled={couponStatus === "loading" || !items.length}>{couponStatus === "loading" ? "檢查中…" : couponPreview ? "重新套用" : "套用"}</button></div><small className={`${styles.couponMessage} ${couponStatus === "error" ? styles.couponError : couponStatus === "success" ? styles.couponSuccess : ""}`} role={couponStatus === "error" ? "alert" : undefined}>{couponMessage ?? "套用後會在摘要顯示折扣，正式建單時仍由伺服器再次驗證。"}</small></div></section>
      <label className={styles.consent}><input type="checkbox" required />我已閱讀並同意服務條款與退換貨政策</label>
    </div>
    <aside className={styles.summary}><h2 className="serif">訂單摘要</h2>{items.map((item) => <div className={styles.line} key={item.variantKey}><span>{item.name}<small>{Object.values(item.selectedOptions ?? { 顏色: item.color, 尺寸: item.size }).join("／")} × {item.quantity}</small></span><strong>{formatTwd(item.price * item.quantity)}</strong></div>)}<div className={styles.amount}><span>商品小計</span><strong>{formatTwd(subtotal)}</strong></div>{couponPreview && <div className={`${styles.amount} ${styles.discount}`}><span>優惠折扣<small>{couponPreview.couponCode}</small></span><strong>−{formatTwd(couponPreview.discountTotal)}</strong></div>}<div className={styles.amount}><span>宅配運費</span><strong>{formatTwd(shippingTotal)}</strong></div><div className={`${styles.amount} ${styles.total}`}><span>總計</span><strong>{formatTwd(total)}</strong></div><button className="button button-primary" type="submit" disabled={submitting || !items.length}>{submitting ? "建立訂單中…" : "確認測試訂單"}</button><p>測試付款會由 Server 驗證價格並保留庫存 {settings.reservationMinutes} 分鐘，不會產生真實扣款。</p></aside>
  </form>;
}
