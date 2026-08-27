"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { refundOrderAction } from "@/app/admin/orders/actions";
import { formatTwd } from "@/lib/money";
import styles from "./order-actions.module.css";

export function RefundOrderForm({ orderId, refundableAmount }: { orderId: string; refundableAmount: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(refundableAmount));
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (refundableAmount <= 0) return <p className={styles.success}>此訂單已無可退款餘額。</p>;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await refundOrderAction({ orderId, amount: Number(amount), reason });
        if (!result.ok) {
          setMessage({ type: "error", text: result.message });
          return;
        }
        setMessage({ type: "success", text: `已記錄退款 ${formatTwd(result.refundAmount)}。` });
        router.refresh();
      })();
    });
  }

  return <form className={styles.form} onSubmit={submit}>
    <label>退款金額（最多 {formatTwd(refundableAmount)}）<input className="input" type="number" min="1" max={refundableAmount} value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
    <label>退款原因（選填）<textarea className="input" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="例如：顧客取消訂單" /></label>
    {message && <p className={message.type === "error" ? styles.error : styles.success} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
    <button className="button button-secondary button-small" type="submit" disabled={pending}>{pending ? "處理中…" : "記錄測試退款"}</button>
    <small>目前僅會記錄測試付款退款，不會產生真實扣款或退款。</small>
  </form>;
}
