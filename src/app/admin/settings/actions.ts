"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const SettingsSchema = z.object({
  brandName: z.string().trim().min(1).max(80),
  supportEmail: z.string().trim().email().max(254),
  shippingFee: z.coerce.number().int().min(0).max(100000),
  reservationMinutes: z.coerce.number().int().min(1).max(1440),
  preorderEnabled: z.boolean(),
});

function settingsRedirect(status: "updated" | "error", message?: string): never {
  const params = new URLSearchParams({ status });
  if (message) params.set("message", message);
  redirect(`/admin/settings?${params.toString()}`);
}

export async function updateStoreSettingsAction(formData: FormData) {
  const { user } = await requireAdmin();
  const parsed = SettingsSchema.safeParse({
    brandName: formData.get("brandName"),
    supportEmail: formData.get("supportEmail"),
    shippingFee: formData.get("shippingFee"),
    reservationMinutes: formData.get("reservationMinutes"),
    preorderEnabled: formData.get("preorderEnabled") === "on",
  });
  if (!parsed.success) settingsRedirect("error", "請確認品牌名稱、客服 Email、運費與庫存保留時間。 ");

  const supabase = await createClient();
  const { error } = await supabase.from("store_settings").update({
    brand_name: parsed.data.brandName,
    support_email: parsed.data.supportEmail.toLowerCase(),
    shipping_fee: parsed.data.shippingFee,
    reservation_minutes: parsed.data.reservationMinutes,
    preorder_enabled: parsed.data.preorderEnabled,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }).eq("id", true);

  if (error) {
    console.error("[admin/settings] update failed", error.message);
    settingsRedirect("error", "商店設定尚未儲存，請稍後再試。");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/checkout");
  revalidatePath("/");
  revalidatePath("/products");
  settingsRedirect("updated");
}

