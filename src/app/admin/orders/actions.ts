"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrders } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const FulfillmentStatus = z.enum(["unfulfilled", "awaiting_stock", "processing", "shipped", "delivered", "cancelled"]);
const ShipmentStatus = z.enum(["pending", "ready", "preparing", "shipped", "in_transit", "delivered", "returned", "cancelled", "exception"]);
const UpdateOrderSchema = z.object({
  orderId: z.string().uuid(),
  fulfillmentStatus: FulfillmentStatus,
  shipmentStatus: ShipmentStatus,
  carrier: z.string().trim().max(80).transform((value) => value || null),
  trackingNumber: z.string().trim().max(120).transform((value) => value || null),
  note: z.string().trim().max(500),
}).superRefine((value, context) => {
  if ((value.carrier === null) !== (value.trackingNumber === null)) {
    context.addIssue({ code: "custom", path: ["trackingNumber"], message: "請同時填寫物流商與追蹤碼。" });
  }
  if (["shipped", "delivered"].includes(value.fulfillmentStatus) && (!value.carrier || !value.trackingNumber)) {
    context.addIssue({ code: "custom", path: ["trackingNumber"], message: "出貨或送達前必須填寫物流商與追蹤碼。" });
  }
  if (["shipped", "in_transit", "delivered"].includes(value.shipmentStatus) && (!value.carrier || !value.trackingNumber)) {
    context.addIssue({ code: "custom", path: ["trackingNumber"], message: "配送中或送達前必須填寫物流商與追蹤碼。" });
  }
});

export type UpdateOrderResult =
  | { ok: true; fulfillmentStatus: string; shipmentStatus: string }
  | { ok: false; message: string };

export async function updateOrderFulfillmentAction(payload: unknown): Promise<UpdateOrderResult> {
  await requireOrders();

  const parsed = UpdateOrderSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "請確認履約狀態與出貨資訊。" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_admin_order_shipment", {
    p_payload: {
      orderId: parsed.data.orderId,
      fulfillmentStatus: parsed.data.fulfillmentStatus,
      shipmentStatus: parsed.data.shipmentStatus,
      carrier: parsed.data.carrier,
      trackingNumber: parsed.data.trackingNumber,
      note: parsed.data.note || null,
    },
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("[admin/orders] update failed", error?.message ?? "empty response");
    if (error?.code === "42501") return { ok: false, message: "目前帳號沒有訂單管理權限。" };
    if (error?.code === "22023") return { ok: false, message: error.message || "履約資料不符合規則。" };
    if (error?.code === "P0002") return { ok: false, message: "找不到這筆訂單。" };
    return { ok: false, message: "訂單尚未更新，請稍後再試。" };
  }

  const result = data as { fulfillmentStatus?: unknown; shipmentStatus?: unknown };
  if (typeof result.fulfillmentStatus !== "string" || typeof result.shipmentStatus !== "string") return { ok: false, message: "訂單回應格式不正確。" };

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true, fulfillmentStatus: result.fulfillmentStatus, shipmentStatus: result.shipmentStatus };
}

const RefundSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().positive().nullable(),
  reason: z.string().trim().max(500),
});

export type RefundOrderResult =
  | { ok: true; paymentStatus: string; refundedAmount: number; refundAmount: number }
  | { ok: false; message: string };

export async function refundOrderAction(payload: unknown): Promise<RefundOrderResult> {
  await requireOrders();
  const parsed = RefundSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "請輸入正確的退款金額與原因。" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("refund_admin_order", {
    p_order_id: parsed.data.orderId,
    p_refund_amount: parsed.data.amount,
    p_reason: parsed.data.reason || null,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("[admin/orders] refund failed", error?.message ?? "empty response");
    if (error?.code === "42501") return { ok: false, message: "目前帳號沒有退款權限。" };
    if (error?.code === "P0002") return { ok: false, message: "找不到這筆訂單或付款紀錄。" };
    if (error?.code === "0A000") return { ok: false, message: "正式金流尚未設定退款流程，請先在金流商後台處理。" };
    if (error?.code === "22023") return { ok: false, message: error.message || "退款金額不符合規則。" };
    return { ok: false, message: "退款尚未完成，請稍後再試。" };
  }

  const result = data as { paymentStatus?: unknown; refundedAmount?: unknown; refundAmount?: unknown };
  if (typeof result.paymentStatus !== "string" || typeof result.refundedAmount !== "number" || typeof result.refundAmount !== "number") {
    return { ok: false, message: "退款回應格式不正確。" };
  }
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true, paymentStatus: result.paymentStatus, refundedAmount: result.refundedAmount, refundAmount: result.refundAmount };
}
