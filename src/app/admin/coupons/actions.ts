"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const CouponFormSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "優惠碼只能使用英文、數字、底線或連字號。"),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().int().positive().max(1000000),
  minimumSubtotal: z.coerce.number().int().nonnegative().max(1000000),
  usageLimit: z.string().trim().optional(),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
});

function localDateTimeToIso(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function couponRedirect(status: string, message?: string): never {
  const params = new URLSearchParams({ status });
  if (message) params.set("message", message);
  redirect(`/admin/coupons?${params.toString()}`);
}

export async function createCouponAction(formData: FormData) {
  await requireAdmin();
  const parsed = CouponFormSchema.safeParse({
    code: formData.get("code"),
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    minimumSubtotal: formData.get("minimumSubtotal") || 0,
    usageLimit: String(formData.get("usageLimit") ?? "").trim() || undefined,
    startsAt: String(formData.get("startsAt") ?? "").trim() || undefined,
    endsAt: String(formData.get("endsAt") ?? "").trim() || undefined,
  });
  if (!parsed.success) couponRedirect("error", "請確認優惠碼、折扣數值與日期格式。");

  if (parsed.data.discountType === "percent" && parsed.data.discountValue > 100) {
    couponRedirect("error", "百分比折扣必須介於 1% 到 100%。");
  }

  const usageLimit = parsed.data.usageLimit ? Number(parsed.data.usageLimit) : null;
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > 1000000)) {
    couponRedirect("error", "使用次數上限必須是正整數。");
  }

  const startsAt = localDateTimeToIso(parsed.data.startsAt);
  const endsAt = localDateTimeToIso(parsed.data.endsAt);
  if ((parsed.data.startsAt && !startsAt) || (parsed.data.endsAt && !endsAt)) couponRedirect("error", "啟用日期格式不正確。");
  if (startsAt && endsAt && startsAt >= endsAt) couponRedirect("error", "結束日期必須晚於開始日期。");

  const supabase = await createClient();
  const { error } = await supabase.from("coupons").insert({
    code: parsed.data.code.toUpperCase(),
    discount_type: parsed.data.discountType,
    discount_value: parsed.data.discountValue,
    minimum_subtotal: parsed.data.minimumSubtotal,
    usage_limit: usageLimit,
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: true,
  });
  if (error) {
    console.error("[admin/coupons] create failed", error.message);
    if (error.code === "23505") couponRedirect("error", "優惠碼已存在，請換一組代碼。");
    couponRedirect("error", "優惠碼尚未建立，請稍後再試。");
  }

  revalidatePath("/admin/coupons");
  couponRedirect("created");
}

export async function toggleCouponAction(formData: FormData) {
  await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const isActive = String(formData.get("isActive")) === "true";
  if (!id.success) couponRedirect("error", "優惠碼資料不正確。");

  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ is_active: !isActive }).eq("id", id.data);
  if (error) {
    console.error("[admin/coupons] toggle failed", error.message);
    couponRedirect("error", "優惠碼狀態尚未更新。");
  }
  revalidatePath("/admin/coupons");
  couponRedirect("updated");
}
