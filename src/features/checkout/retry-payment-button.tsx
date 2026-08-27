"use client";

import { useState } from "react";
import { RoundedSelect } from "@/components/rounded-select";
import styles from "./retry-payment-button.module.css";

type RetryPaymentButtonProps = {
  orderId: string;
  orderNumber: string;
};

type PaymentMethod = "credit" | "atm" | "cvs";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  credit: "信用卡",
  atm: "ATM 虛擬帳號",
  cvs: "超商代碼",
};
const paymentMethodOptions = (Object.entries(paymentMethodLabels) as Array<[PaymentMethod, string]>).map(([value, label]) => ({ value, label }));

export function RetryPaymentButton({ orderId, orderNumber }: RetryPaymentButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit");

  async function retryPayment() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          retryOrderId: orderId,
          idempotencyKey: `retry-${orderId}`,
          paymentProvider: "ecpay",
          paymentMethod,
        }),
      });
      const result = await response.json() as {
        order?: { orderNumber?: string; grandTotal?: number; discountTotal?: number; couponCode?: string | null };
        payment?: { provider?: string; method?: string; action?: string; fields?: Record<string, string> };
        error?: { message?: string };
      };
      const payment = result.payment;
      if (!response.ok || !result.order?.orderNumber || payment?.provider !== "ecpay" || payment.method !== "POST" || !payment.action || !payment.fields) {
        throw new Error(result.error?.message ?? "目前無法重新付款，請稍後再試。");
      }

      window.sessionStorage.setItem("morii-demo-order", JSON.stringify({
        orderNumber: result.order.orderNumber,
        total: result.order.grandTotal ?? 0,
        discountTotal: result.order.discountTotal ?? 0,
        couponCode: result.order.couponCode ?? null,
        provider: "ecpay",
        method: paymentMethod,
      }));

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
    } catch (retryError) {
      setPending(false);
      setError(retryError instanceof Error ? retryError.message : "目前無法重新付款，請稍後再試。");
    }
  }

  return <div className={styles.wrapper}>
    <label className={styles.methodLabel} htmlFor={`retry-payment-method-${orderId}`}>重新付款方式</label>
    <div className={styles.actions}>
      <RoundedSelect id={`retry-payment-method-${orderId}`} options={paymentMethodOptions} value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)} disabled={pending} ariaLabel="重新付款方式" />
      <button className="button button-secondary button-small" type="button" aria-label={`使用${paymentMethodLabels[paymentMethod]}重新付款 ${orderNumber}`} onClick={retryPayment} disabled={pending}>
        {pending ? "建立付款中…" : "重新付款"}
      </button>
    </div>
    {error && <small className={styles.error} role="alert">{error}</small>}
    {!error && <small className={styles.hint}>會建立新的待付款訂單，不會重複扣款。</small>}
  </div>;
}
