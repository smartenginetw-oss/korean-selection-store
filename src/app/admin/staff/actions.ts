"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOwner } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const StaffSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["partner", "staff", "catalog_staff", "order_staff", "customer"]),
});

function staffRedirect(status: "updated" | "error", message?: string): never {
  const params = new URLSearchParams({ status });
  if (message) params.set("message", message);
  redirect(`/admin/staff?${params.toString()}`);
}

export async function setStaffMemberAction(formData: FormData) {
  await requireOwner();
  const parsed = StaffSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) staffRedirect("error", "請輸入正確的帳號電子郵件。");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_member", { p_email: parsed.data.email, p_role: parsed.data.role });
  if (error) {
    console.error("[admin/staff] update failed", error.message);
    if (error.code === "P0002") staffRedirect("error", "找不到這個 Auth 帳號。請先在 Supabase Authentication 建立帳號，再授予員工權限。");
    if (error.code === "42501") staffRedirect("error", "老闆帳號不能被撤銷，或目前帳號沒有操作權限。");
    staffRedirect("error", "員工權限尚未更新，請稍後再試。");
  }

  revalidatePath("/admin/staff");
  staffRedirect("updated");
}
