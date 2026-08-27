"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function PurchaseAnalytics({ orderNumber, state }: { orderNumber: string; state: "test" | "paid" | "failed" | "pending" }) {
  useEffect(() => {
    if (!orderNumber || (state !== "test" && state !== "paid")) return;
    const raw = window.sessionStorage.getItem("morii-demo-order");
    if (!raw) return;
    try {
      const order = JSON.parse(raw) as { orderNumber?: unknown; total?: unknown };
      if (order.orderNumber !== orderNumber) return;
      trackEvent("purchase", {
        transaction_id: orderNumber,
        currency: "TWD",
        value: typeof order.total === "number" ? order.total : undefined,
      });
      window.sessionStorage.removeItem("morii-demo-order");
    } catch {
      // Ignore malformed local session state; checkout has already completed.
    }
  }, [orderNumber, state]);

  return null;
}
