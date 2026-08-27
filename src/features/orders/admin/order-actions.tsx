"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateOrderFulfillmentAction } from "@/app/admin/orders/actions";
import { RoundedSelect } from "@/components/rounded-select";
import type { AdminOrderSummary } from "./server";
import styles from "./order-actions.module.css";

const statuses = [
  ["unfulfilled", "未處理"],
  ["awaiting_stock", "等待到貨"],
  ["processing", "處理中"],
  ["shipped", "已出貨"],
  ["delivered", "已送達"],
  ["cancelled", "已取消"],
] as const;
const shipmentStatuses = [
  ["pending", "待出貨"],
  ["ready", "可交寄"],
  ["preparing", "準備出貨"],
  ["shipped", "已出貨"],
  ["in_transit", "配送中"],
  ["delivered", "已送達"],
  ["returned", "已退回"],
  ["cancelled", "已取消"],
  ["exception", "配送異常"],
] as const;
type FulfillmentStatus = (typeof statuses)[number][0];
type ShipmentStatus = (typeof shipmentStatuses)[number][0];
const statusOptions = statuses.map(([value, label]) => ({ value, label }));
const shipmentStatusOptions = shipmentStatuses.map(([value, label]) => ({ value, label }));

export function OrderActions({ order }: { order: AdminOrderSummary }) {
  const router = useRouter();
  const [status, setStatus] = useState<FulfillmentStatus>(order.fulfillmentStatus as FulfillmentStatus);
  const [shipmentStatus, setShipmentStatus] = useState<ShipmentStatus>((order.shipment?.status ?? "pending") as ShipmentStatus);
  const [carrier, setCarrier] = useState(order.shipment?.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(order.shipment?.trackingNumber ?? "");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await updateOrderFulfillmentAction({
          orderId: order.id,
          fulfillmentStatus: status,
          shipmentStatus,
          carrier,
          trackingNumber,
          note,
        });
        if (!result.ok) {
          setMessage({ type: "error", text: result.message });
          return;
        }
        setNote("");
        setMessage({ type: "success", text: "訂單履約資料已更新。" });
        router.refresh();
      })();
    });
  }

  const shippingRequired = status === "shipped" || status === "delivered" || shipmentStatus === "shipped" || shipmentStatus === "in_transit" || shipmentStatus === "delivered";
  return <details className={styles.details}>
    <summary>更新履約</summary>
    <form className={styles.form} onSubmit={handleSubmit}>
      <label>履約狀態<RoundedSelect options={statusOptions} value={status} onValueChange={(value) => setStatus(value as FulfillmentStatus)} ariaLabel="履約狀態" /></label>
      <label>出貨狀態<RoundedSelect options={shipmentStatusOptions} value={shipmentStatus} onValueChange={(value) => setShipmentStatus(value as ShipmentStatus)} ariaLabel="出貨狀態" /></label>
      <label>物流商<input className="input" value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="例如：黑貓宅急便" required={shippingRequired} /></label>
      <label>追蹤碼<input className="input" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="物流單號" required={shippingRequired} /></label>
      <label>備註（選填）<textarea className="input" value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} /></label>
      {message && <p className={message.type === "error" ? styles.error : styles.success} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
      <button className="button button-primary button-small" type="submit" disabled={pending}>{pending ? "更新中…" : "儲存履約資料"}</button>
    </form>
  </details>;
}
