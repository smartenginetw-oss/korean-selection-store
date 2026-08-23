"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const FulfillmentStatus = z.enum(["unfulfilled", "awaiting_stock", "processing", "shipped", "delivered", "cancelled"]);
const UpdateOrderSchema = z.object({
  orderId: z.string().uuid(),
  fulfillmentStatus: FulfillmentStatus,
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
});

export type UpdateOrderResult =
  | { ok: true; fulfillmentStatus: string }
  | { ok: false; message: string };

export async function updateOrderFulfillmentAction(payload: unknown): Promise<UpdateOrderResult> {
  await requireAdmin();

  const parsed = UpdateOrderSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "請確認履約狀態與出貨資訊。" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_admin_order_fulfillment", {
    p_payload: {
      orderId: parsed.data.orderId,
      fulfillmentStatus: parsed.data.fulfillmentStatus,
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

  const result = data as { fulfillmentStatus?: unknown };
  if (typeof result.fulfillmentStatus !== "string") return { ok: false, message: "訂單回應格式不正確。" };

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true, fulfillmentStatus: result.fulfillmentStatus };
}
