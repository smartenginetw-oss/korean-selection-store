"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireReports } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const AmountSchema = z.coerce.number().int().nonnegative().max(10000000);

function formAmount(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return AmountSchema.parse(value === "" ? 0 : value);
}

function reportRedirect(formData: FormData, extra: Record<string, string>) {
  const params = new URLSearchParams();
  for (const key of ["start", "end", "granularity", "cashflow"]) {
    const value = String(formData.get(`return_${key}`) ?? "").trim();
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `/admin/reports?${params.toString()}`;
}

export async function upsertOperatingExpenseAction(formData: FormData) {
  const access = await requireReports();
  if (access.role !== "admin" && access.role !== "staff") redirect("/admin?notice=role_forbidden");

  const monthResult = MonthSchema.safeParse(String(formData.get("periodMonth") ?? ""));
  if (!monthResult.success) redirect(reportRedirect(formData, { expenseError: "月份格式不正確。" }));

  let payload: { periodMonth: string; rentCost: number; shippingCost: number; advertisingCost: number; packagingCost: number; otherCost: number; notes: string };
  try {
    payload = {
      periodMonth: `${monthResult.data}-01`,
      rentCost: formAmount(formData, "rentCost"),
      shippingCost: formAmount(formData, "shippingCost"),
      advertisingCost: formAmount(formData, "advertisingCost"),
      packagingCost: formAmount(formData, "packagingCost"),
      otherCost: formAmount(formData, "otherCost"),
      notes: String(formData.get("notes") ?? "").trim().slice(0, 500),
    };
  } catch {
    redirect(reportRedirect(formData, { expenseError: "費用必須是 0 以上的整數。" }));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_admin_operating_expense", { p_payload: payload });
  if (error) {
    console.error("[admin/reports] operating expense save failed", error.message);
    const message = error.code === "42501" ? "目前帳號沒有營業費用管理權限。" : "營業費用尚未儲存，請稍後再試。";
    redirect(reportRedirect(formData, { expenseError: message }));
  }

  revalidatePath("/admin/reports");
  redirect(reportRedirect(formData, { expenseSaved: "1" }));
}
