"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./order-status-refresh.module.css";
import { fulfillmentStatusLabels, orderStatusLabels, paymentStatusLabels } from "./order-status-labels";

const paymentLabels: Record<string, string> = { ...paymentStatusLabels, pending: "待付款／等待確認" };
const MAX_POLLS = 12;
const pollDelays = [3000, 4000, 5000, 5000, 6000, 6000, 7000, 7000, 8000, 8000, 9000] as const;
const terminalOrderStatuses = new Set(["completed", "cancelled", "expired"]);

function clearPollTimer(timer: { current: ReturnType<typeof setTimeout> | null }) {
  if (timer.current) {
    clearTimeout(timer.current);
    timer.current = null;
  }
}

type OrderStatusRefreshProps = {
  orderId: string;
  initialPaymentStatus: string;
  initialFulfillmentStatus: string;
  initialOrderStatus: string;
};

export function OrderStatusRefresh({ orderId, initialPaymentStatus, initialFulfillmentStatus, initialOrderStatus }: OrderStatusRefreshProps) {
  const [status, setStatus] = useState({ payment: initialPaymentStatus, fulfillment: initialFulfillmentStatus, order: initialOrderStatus });
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pollCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const statusRef = useRef(status);
  const refreshingRef = useRef(false);
  const refreshRef = useRef<(automatic?: boolean) => void>(() => undefined);

  const scheduleNextPoll = useCallback(() => {
    if (!mounted.current || pollCount.current >= MAX_POLLS || statusRef.current.payment !== "pending" || terminalOrderStatuses.has(statusRef.current.order)) return;
    clearPollTimer(timer);
    const delay = pollDelays[Math.min(pollCount.current, pollDelays.length - 1)];
    timer.current = setTimeout(() => {
      timer.current = null;
      if (mounted.current) void refreshRef.current(true);
    }, delay);
  }, []);

  const refresh = useCallback(async (automatic = false) => {
    if (!mounted.current || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store", signal: controller.signal });
      const result = await response.json() as { order?: { paymentStatus?: string; fulfillmentStatus?: string; orderStatus?: string }; error?: { message?: string } };
      if (!response.ok || !result.order?.paymentStatus || !result.order.fulfillmentStatus || !result.order.orderStatus) {
        throw new Error(result.error?.message ?? "目前無法更新訂單狀態。");
      }
      const next = { payment: result.order.paymentStatus, fulfillment: result.order.fulfillmentStatus, order: result.order.orderStatus };
      const previous = statusRef.current;
      const changed = next.payment !== previous.payment || next.fulfillment !== previous.fulfillment || next.order !== previous.order;
      statusRef.current = next;
      if (mounted.current) {
        setStatus(next);
        setMessage(changed ? "訂單狀態已更新。" : automatic ? "尚未收到新的付款結果。" : "目前沒有新的狀態更新。");
      }
      pollCount.current += 1;
      if (next.payment !== "pending" || terminalOrderStatuses.has(next.order)) pollCount.current = MAX_POLLS;
      scheduleNextPoll();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (mounted.current) setMessage(error instanceof Error ? error.message : "目前無法更新訂單狀態。");
    } finally {
      if (abortController.current === controller) abortController.current = null;
      refreshingRef.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [orderId, scheduleNextPoll]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    if (initialPaymentStatus === "pending") scheduleNextPoll();
    return () => {
      mounted.current = false;
      clearPollTimer(timer);
      abortController.current?.abort();
    };
  }, [initialPaymentStatus, orderId, scheduleNextPoll]);

  const isPending = status.payment === "pending";
  return <div className={styles.card} aria-live="polite">
    <div className={styles.row}><span>付款狀態</span><strong>{paymentLabels[status.payment] ?? "狀態更新"}</strong></div>
    <div className={styles.row}><span>訂單狀態</span><strong>{orderStatusLabels[status.order] ?? "狀態更新"}</strong></div>
    <div className={styles.row}><span>履約狀態</span><strong>{fulfillmentStatusLabels[status.fulfillment] ?? "狀態更新"}</strong></div>
    {isPending && <small className={styles.hint}>付款結果同步中，系統會自動檢查最多 1 分鐘。</small>}
    <div className={styles.actions}><button className="button button-secondary button-small" type="button" onClick={() => { clearPollTimer(timer); pollCount.current = 0; void refresh(); }} disabled={refreshing}>{refreshing ? "更新中…" : "更新付款狀態"}</button>{message && <small className={styles.message}>{message}</small>}</div>
  </div>;
}
