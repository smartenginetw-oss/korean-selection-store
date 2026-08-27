"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProcurement } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const SupplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  country: z.string().trim().min(1).max(80),
  contactName: z.string().trim().max(80),
  phone: z.string().trim().max(40),
  email: z.string().trim().email().max(254).or(z.literal("")),
  line: z.string().trim().max(80),
  kakao: z.string().trim().max(80),
  paymentTerms: z.string().trim().max(240),
  note: z.string().trim().max(2000),
});

function optionalValue(value: string) {
  return value.trim() || null;
}

function supplierRedirect(status: "created" | "updated" | "error", message?: string): never {
  const params = new URLSearchParams({ status });
  if (message) params.set("message", message);
  redirect(`/admin/suppliers?${params.toString()}`);
}

export async function saveSupplierAction(formData: FormData) {
  await requireProcurement();
  const idValue = String(formData.get("id") ?? "").trim();
  const parsed = SupplierSchema.safeParse({
    id: idValue || undefined,
    name: formData.get("name"),
    country: formData.get("country") ?? "韓國",
    contactName: formData.get("contactName") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    line: formData.get("line") ?? "",
    kakao: formData.get("kakao") ?? "",
    paymentTerms: formData.get("paymentTerms") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) supplierRedirect("error", "請確認供應商名稱、國家與聯絡資料格式。電子郵件若填寫必須是有效格式。");

  const payload = {
    name: parsed.data.name,
    country: parsed.data.country,
    contact_name: optionalValue(parsed.data.contactName),
    phone: optionalValue(parsed.data.phone),
    email: optionalValue(parsed.data.email),
    line: optionalValue(parsed.data.line),
    kakao: optionalValue(parsed.data.kakao),
    payment_terms: optionalValue(parsed.data.paymentTerms),
    note: optionalValue(parsed.data.note),
  };
  const supabase = await createClient();
  const result = parsed.data.id
    ? await supabase.from("suppliers").update(payload).eq("id", parsed.data.id)
    : await supabase.from("suppliers").insert(payload);

  if (result.error) {
    console.error("[admin/suppliers] save failed", result.error.message);
    if (result.error.code === "23505") supplierRedirect("error", "這個供應商名稱已存在，請換一個名稱。");
    supplierRedirect("error", "供應商資料尚未儲存，請稍後再試。");
  }

  revalidatePath("/admin/suppliers");
  supplierRedirect(parsed.data.id ? "updated" : "created");
}

export async function toggleSupplierAction(formData: FormData) {
  await requireProcurement();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const isActive = String(formData.get("isActive")) === "true";
  if (!id.success) supplierRedirect("error", "供應商資料不正確。");

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update({ is_active: !isActive }).eq("id", id.data);
  if (error) {
    console.error("[admin/suppliers] toggle failed", error.message);
    supplierRedirect("error", "供應商狀態尚未更新。");
  }

  revalidatePath("/admin/suppliers");
  supplierRedirect("updated");
}
