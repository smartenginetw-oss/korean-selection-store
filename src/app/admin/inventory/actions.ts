"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const InventoryAdjustmentSchema = z.object({
  variantId: z.string().uuid(),
  onHand: z.number().int().nonnegative().max(100000),
  lowStockThreshold: z.number().int().nonnegative().max(100000),
  reason: z.string().trim().min(1).max(240),
});

export type AdjustInventoryResult = { ok: true } | { ok: false; message: string };

export async function adjustInventoryAction(payload: unknown): Promise<AdjustInventoryResult> {
  await requireAdmin();
  const parsed = InventoryAdjustmentSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "請填寫正確的庫存數量、低庫存門檻與調整原因。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_admin_inventory", {
    p_variant_id: parsed.data.variantId,
    p_on_hand: parsed.data.onHand,
    p_low_stock_threshold: parsed.data.lowStockThreshold,
    p_reason: parsed.data.reason,
  });
  if (error) {
    console.error("[admin/inventory] adjustment failed", error.message);
    if (error.code === "42501") return { ok: false, message: "目前帳號沒有庫存管理權限。" };
    if (error.code === "P0002") return { ok: false, message: "找不到這筆庫存資料。" };
    if (error.code === "22023") return { ok: false, message: error.message.includes("reserved") ? "現有庫存不可低於已保留數量。" : "庫存調整資料不正確。" };
    return { ok: false, message: "庫存尚未更新，請稍後再試。" };
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  return { ok: true };
}
