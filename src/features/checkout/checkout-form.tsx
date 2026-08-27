"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/features/cart/cart-provider";
import { TaiwanAddressFields } from "@/components/taiwan-address-fields";
import { RoundedSelect } from "@/components/rounded-select";
import { ConvenienceStoreSelector } from "@/components/convenience-store-selector";
import { formatTwd } from "@/lib/money";
import { isConvenienceStoreMethod, isShippingMethod, shippingFeeFor, shippingOptions, type ShippingMethod } from "@/lib/shipping";
import { toAnalyticsItem, trackEvent } from "@/lib/analytics";
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

type PaymentSelection = "test" | "ecpay_credit" | "ecpay_atm" | "ecpay_cvs";

export function CheckoutForm({ settings, prefill, testPaymentEnabled, ecpayEnabled }: { settings: Pick<StoreSettings, "shippingFee" | "cvs711Fee" | "cvsFamilyFee" | "reservationMinutes">; prefill?: CheckoutPrefill; testPaymentEnabled: boolean; ecpayEnabled: boolean }) {
  const router = useRouter();
  const { items, clearCart, availabilityStatus } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponPreview, setCouponPreview] = useState<{ couponCode: string; discountTotal: number; grandTotal: number } | null>(null);
  const [paymentSelection, setPaymentSelection] = useState<PaymentSelection>(testPaymentEnabled ? "test" : "ecpay_credit");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("home_delivery");
  const paymentProvider = paymentSelection === "test" ? "test" : "ecpay";
  const idempotencyKey = useRef<string | null>(null);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingTotal = items.length ? shippingFeeFor(shippingMethod, settings) : 0;
  const total = subtotal - (couponPreview?.discountTotal ?? 0) + shippingTotal;
  const checkoutTracked = useRef(false);
  const unavailableCount = items.filter((item) => item.availability === "unavailable").length;
  const priceChangedCount = items.filter((item) => item.priceChanged).length;
  const missingVariantCount = items.filter((item) => !item.variantId).length;
  const cartNeedsReview = availabilityStatus === "checking" || unavailableCount > 0 || priceChangedCount > 0 || missingVariantCount > 0;

  useEffect(() => {
    if (checkoutTracked.current || !items.length) return;
    checkoutTracked.current = true;
    trackEvent("begin_checkout", {
      currency: "TWD",
      value: total,
      items: items.map((item) => toAnalyticsItem({ id: item.productId ?? item.variantKey, name: item.name, price: item.price, quantity: item.quantity, variant: item.variantId })),
    });
  }, [items, total]);

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
        body: JSON.stringify({ couponCode: code, shippingMethod, items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })) }),
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
    if (cartNeedsReview) {
      setErrorMessage(availabilityStatus === "checking" ? "正在同步商品狀態，請稍候再送出。" : "購物車內有商品或價格已變更，請返回購物車確認後再送出。");
      return;
    }
    if (!testPaymentEnabled && !ecpayEnabled) {
      setErrorMessage("目前尚未設定可用的付款方式，請稍後再試。");
      return;
    }
    const missingVariant = items.some((item) => !item.variantId);
    if (missingVariant) {
      setErrorMessage("商品規格尚未同步，請回到商品頁重新加入購物車。");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const selectedShippingMethod = String(formData.get("shippingMethod") ?? "home_delivery");
    if (!isShippingMethod(selectedShippingMethod)) {
      setErrorMessage("請選擇有效的配送方式。");
      return;
    }
    const city = String(formData.get("city") ?? "").trim();
    const district = String(formData.get("district") ?? "").trim();
    const storeCode = String(formData.get("storeCode") ?? "").trim();
    const storeName = String(formData.get("storeName") ?? "").trim();
    const storeAddress = String(formData.get("storeAddress") ?? "").trim();
    if (selectedShippingMethod === "home_delivery" && (!city || !district || !String(formData.get("postalCode") ?? "").trim() || !String(formData.get("address") ?? "").trim())) {
      setErrorMessage("請先填寫完整的宅配地址。");
      return;
    }
    if (isConvenienceStoreMethod(selectedShippingMethod) && (!storeCode || !storeName || !storeAddress)) {
      setErrorMessage("請先選擇取貨門市。");
      return;
    }
    idempotencyKey.current ??= `web-${crypto.randomUUID()}`;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          paymentProvider,
          paymentMethod: paymentSelection === "test" ? undefined : paymentSelection.replace("ecpay_", ""),
          shippingMethod: selectedShippingMethod,
          consentVersion: "terms-v1",
          couponCode: couponCode.trim() || undefined,
          customer: {
            email: formData.get("email"),
            phone: formData.get("phone"),
            recipientName: formData.get("recipient"),
            postalCode: formData.get("postalCode"),
            city,
            district,
            addressLine: formData.get("address"),
            storeCode: storeCode || undefined,
            storeName: storeName || undefined,
            storeAddress: storeAddress || undefined,
          },
          items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        }),
      });
      const result = await response.json() as {
        order?: { orderNumber?: string; orderId?: string; grandTotal?: number; discountTotal?: number; couponCode?: string | null };
        payment?: { provider?: string; method?: string; action?: string; fields?: Record<string, string> };
        error?: { message?: string };
      };
      if (!response.ok || !result.order?.orderNumber) {
        if (response.status === 409) idempotencyKey.current = null;
        throw new Error(result.error?.message ?? "目前無法建立訂單，請稍後再試。");
      }

      const orderNumber = result.order.orderNumber;
      const payment = result.payment;
      if (paymentProvider === "ecpay" && (payment?.provider !== "ecpay" || payment.method !== "POST" || !payment.action || !payment.fields)) {
        throw new Error("ECPay 付款頁資料不完整，請稍後再試。");
      }
      window.sessionStorage.setItem("morii-demo-order", JSON.stringify({ orderNumber, total: result.order.grandTotal ?? total, discountTotal: result.order.discountTotal ?? 0, couponCode: result.order.couponCode ?? null, provider: paymentProvider, method: paymentSelection }));
      clearCart();
      if (paymentProvider === "ecpay") {
        if (!payment || !payment.action || !payment.fields) throw new Error("ECPay 付款頁資料不完整，請稍後再試。");
        const form = document.createElement("form");
        form.method = "POST";
        form.action = payment.action;
        form.style.display = "none";
        for (const [name, value] of Object.entries(payment.fields)) {
          if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) continue;
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }
      router.push(`/checkout/result?order=${orderNumber}`);
    } catch (submitError) {
      setErrorMessage(submitError instanceof Error ? submitError.message : "目前無法建立訂單，請稍後再試。");
      setSubmitting(false);
    }
  }

  return <form className={styles.form} onSubmit={submit}>
    {errorMessage && <div className={styles.error} role="alert">{errorMessage}</div>}
    {availabilityStatus === "checking" && <div className={styles.availabilityNotice} role="status">正在同步商品狀態，完成後才能送出訂單。</div>}
    {availabilityStatus === "error" && <div className={styles.availabilityNotice} role="status">商品狀態暫時無法同步；送出訂單時仍會由伺服器再次驗證。</div>}
    {unavailableCount > 0 && <div className={styles.availabilityNotice} role="alert">有 {unavailableCount} 項商品已售罄，請返回購物車移除後再結帳。</div>}
    {priceChangedCount > 0 && <div className={styles.availabilityNotice} role="alert">有 {priceChangedCount} 項商品價格已更新，請返回商品頁確認後再結帳。</div>}
    <div className={styles.sections}>
      <section><h2 className="serif">聯絡資料</h2>{prefill && <p className={styles.prefillNote}>已帶入會員資料，可在送出前修改。</p>}<div className={styles.fields}><div className="field"><label htmlFor="name">姓名</label><input className="input" id="name" name="name" autoComplete="name" required maxLength={80} defaultValue={prefill?.displayName} /></div><div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={prefill?.email} /></div></div></section>
      <section><h2 className="serif">收件資料</h2><div className={styles.fields}><div className="field"><label htmlFor="recipient">收件人</label><input className="input" id="recipient" name="recipient" required maxLength={80} defaultValue={prefill?.address?.recipientName || prefill?.displayName} /></div><div className="field"><label htmlFor="phone">收件手機</label><input className="input" id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required pattern="09[0-9]{8}" placeholder="0912345678" defaultValue={prefill?.phone || prefill?.address?.phone} /></div></div></section>
      <section><h2 className="serif">配送方式</h2><div className="field"><label htmlFor="shippingMethod">選擇配送方式</label><RoundedSelect id="shippingMethod" name="shippingMethod" options={shippingOptions} value={shippingMethod} onValueChange={(value) => { if (isShippingMethod(value)) { setShippingMethod(value); setCouponPreview(null); setCouponStatus("idle"); setCouponMessage(null); } }} ariaLabel="配送方式" /><small className={styles.fieldHint}>宅配與超商取貨皆會在建單時由伺服器重新驗證運費與配送資料。</small></div>{shippingMethod === "home_delivery" ? <div className={styles.fields}><TaiwanAddressFields className={styles.row} idPrefix="checkout" defaultCity={prefill?.address?.city} defaultDistrict={prefill?.address?.district} /><div className={styles.row}><div className="field"><label htmlFor="postalCode">郵遞區號</label><input className="input" id="postalCode" name="postalCode" inputMode="numeric" minLength={3} maxLength={6} defaultValue={prefill?.address?.postalCode} /></div><div /></div><div className="field"><label htmlFor="address">地址</label><input className="input" id="address" name="address" autoComplete="street-address" maxLength={160} defaultValue={prefill?.address?.addressLine} /></div></div> : <ConvenienceStoreSelector key={shippingMethod} method={shippingMethod} onChange={() => setCouponPreview(null)} />}</section>
      <section><h2 className="serif">付款方式</h2>{testPaymentEnabled && <label className={styles.payment}><input type="radio" name="payment" value="test" checked={paymentSelection === "test"} onChange={() => setPaymentSelection("test")} /><span><strong>測試付款</strong><small>Preview 專用，不會產生真實扣款</small></span></label>}{ecpayEnabled && <><label className={styles.payment}><input type="radio" name="payment" value="ecpay_credit" checked={paymentSelection === "ecpay_credit"} onChange={() => setPaymentSelection("ecpay_credit")} /><span><strong>ECPay 綠界｜信用卡</strong><small>導向綠界測試付款頁</small></span></label><label className={styles.payment}><input type="radio" name="payment" value="ecpay_atm" checked={paymentSelection === "ecpay_atm"} onChange={() => setPaymentSelection("ecpay_atm")} /><span><strong>ECPay 綠界｜ATM 虛擬帳號</strong><small>測試環境取號後依頁面資訊繳費</small></span></label><label className={styles.payment}><input type="radio" name="payment" value="ecpay_cvs" checked={paymentSelection === "ecpay_cvs"} onChange={() => setPaymentSelection("ecpay_cvs")} /><span><strong>ECPay 綠界｜超商代碼</strong><small>測試環境取號後至超商繳費</small></span></label></>}{!testPaymentEnabled && !ecpayEnabled && <p className={styles.fieldHint}>目前尚未設定可用的付款方式。</p>}</section>
      <section><h2 className="serif">優惠碼</h2><div className="field"><label htmlFor="couponCode">優惠碼（選填）</label><div className={styles.couponRow}><input className="input" id="couponCode" name="couponCode" value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setCouponPreview(null); setCouponStatus("idle"); setCouponMessage(null); }} maxLength={40} autoCapitalize="characters" placeholder="輸入優惠碼" /><button className="button button-secondary button-small" type="button" onClick={applyCoupon} disabled={couponStatus === "loading" || !items.length}>{couponStatus === "loading" ? "檢查中…" : couponPreview ? "重新套用" : "套用"}</button></div><small className={`${styles.couponMessage} ${couponStatus === "error" ? styles.couponError : couponStatus === "success" ? styles.couponSuccess : ""}`} role={couponStatus === "error" ? "alert" : undefined}>{couponMessage ?? "套用後會在摘要顯示折扣，正式建單時仍由伺服器再次驗證。"}</small></div></section>
      <label className={styles.consent}><input type="checkbox" required />我已閱讀並同意服務條款與退換貨政策</label>
    </div>
    <aside className={styles.summary}><h2 className="serif">訂單摘要</h2>{items.map((item) => <div className={styles.line} key={item.variantKey}><span>{item.name}<small>{Object.values(item.selectedOptions ?? { 顏色: item.color, 尺寸: item.size }).join("／")} × {item.quantity}</small></span><strong>{formatTwd(item.price * item.quantity)}</strong></div>)}<div className={styles.amount}><span>商品小計</span><strong>{formatTwd(subtotal)}</strong></div>{couponPreview && <div className={`${styles.amount} ${styles.discount}`}><span>優惠折扣<small>{couponPreview.couponCode}</small></span><strong>−{formatTwd(couponPreview.discountTotal)}</strong></div>}<div className={styles.amount}><span>{shippingOptions.find((option) => option.value === shippingMethod)?.label ?? "配送運費"}</span><strong>{formatTwd(shippingTotal)}</strong></div><div className={`${styles.amount} ${styles.total}`}><span>總計</span><strong>{formatTwd(total)}</strong></div><button className="button button-primary" type="submit" disabled={submitting || !items.length || cartNeedsReview || (!testPaymentEnabled && !ecpayEnabled)}>{submitting ? "建立訂單中…" : cartNeedsReview && availabilityStatus === "checking" ? "同步商品狀態中…" : cartNeedsReview ? "請先確認購物車" : paymentProvider === "ecpay" ? "前往 ECPay 測試付款" : "確認測試訂單"}</button><p>{paymentProvider === "ecpay" ? `訂單會先保留庫存 ${settings.reservationMinutes} 分鐘，付款結果由 ECPay 回呼確認。` : `測試付款會由 Server 驗證價格並保留庫存 ${settings.reservationMinutes} 分鐘，不會產生真實扣款。`}</p></aside>
  </form>;
}
