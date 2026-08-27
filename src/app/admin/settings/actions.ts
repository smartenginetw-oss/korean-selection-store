"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOwner } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const SettingsSchema = z.object({
  brandName: z.string().trim().min(1).max(80),
  supportEmail: z.string().trim().email().max(254),
  shippingFee: z.coerce.number().int().min(0).max(100000),
  cvs711Fee: z.coerce.number().int().min(0).max(100000),
  cvsFamilyFee: z.coerce.number().int().min(0).max(100000),
  reservationMinutes: z.coerce.number().int().min(1).max(1440),
  preorderEnabled: z.boolean(),
  instagramUrl: z.string().trim().max(300).optional(),
  threadsUrl: z.string().trim().max(300).optional(),
  facebookUrl: z.string().trim().max(300).optional(),
  lineOfficialUrl: z.string().trim().max(300).optional(),
}).superRefine((data, ctx) => {
  const fields = [
    ["instagramUrl", data.instagramUrl, /instagram\.com\/[A-Za-z0-9._-]+\/?$/i],
    ["threadsUrl", data.threadsUrl, /threads\.net\/@[A-Za-z0-9._-]+\/?$/i],
    ["facebookUrl", data.facebookUrl, /facebook\.com\/[A-Za-z0-9._-]+\/?$/i],
    ["lineOfficialUrl", data.lineOfficialUrl, /(lin\.ee\/[A-Za-z0-9_-]+|line\.me\/R\/ti\/p\/@?[A-Za-z0-9._-]+)\/?$/i],
  ] as const;
  for (const [path, value, pattern] of fields) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !pattern.test(url.hostname + url.pathname) || url.search || url.hash) throw new Error("invalid");
    } catch {
      ctx.addIssue({ code: "custom", path: [path], message: "請輸入支援的 HTTPS 社群連結。" });
    }
  }
});

function settingsRedirect(status: "updated" | "error", message?: string): never {
  const params = new URLSearchParams({ status });
  if (message) params.set("message", message);
  redirect(`/admin/settings?${params.toString()}`);
}

export async function updateStoreSettingsAction(formData: FormData) {
  const { user } = await requireOwner();
  const parsed = SettingsSchema.safeParse({
    brandName: formData.get("brandName"),
    supportEmail: formData.get("supportEmail"),
    shippingFee: formData.get("shippingFee"),
    cvs711Fee: formData.get("cvs711Fee"),
    cvsFamilyFee: formData.get("cvsFamilyFee"),
    reservationMinutes: formData.get("reservationMinutes"),
    preorderEnabled: formData.get("preorderEnabled") === "on",
    instagramUrl: formData.get("instagramUrl") || undefined,
    threadsUrl: formData.get("threadsUrl") || undefined,
    facebookUrl: formData.get("facebookUrl") || undefined,
    lineOfficialUrl: formData.get("lineOfficialUrl") || undefined,
  });
  if (!parsed.success) settingsRedirect("error", "請確認品牌名稱、客服電子郵件、各配送運費與庫存保留時間。 ");

  const supabase = await createClient();
  const { error } = await supabase.from("store_settings").update({
    brand_name: parsed.data.brandName,
    support_email: parsed.data.supportEmail.toLowerCase(),
    shipping_fee: parsed.data.shippingFee,
    cvs_711_fee: parsed.data.cvs711Fee,
    cvs_family_fee: parsed.data.cvsFamilyFee,
    reservation_minutes: parsed.data.reservationMinutes,
    preorder_enabled: parsed.data.preorderEnabled,
    instagram_url: parsed.data.instagramUrl || null,
    threads_url: parsed.data.threadsUrl || null,
    facebook_url: parsed.data.facebookUrl || null,
    line_official_url: parsed.data.lineOfficialUrl || null,
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
