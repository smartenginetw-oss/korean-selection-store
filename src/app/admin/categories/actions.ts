"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCatalog } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const CategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  description: z.string().trim().max(500),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

function categoryRedirect(status: "created" | "updated" | "error", message?: string): never {
  const params = new URLSearchParams({ status });
  if (message) params.set("message", message);
  redirect(`/admin/categories?${params.toString()}`);
}

export async function saveCategoryAction(formData: FormData) {
  await requireCatalog();
  const id = String(formData.get("id") ?? "").trim() || undefined;
  const parsed = CategorySchema.safeParse({
    id,
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
  });
  if (!parsed.success) categoryRedirect("error", "請確認分類名稱、系統代碼、說明與排序格式。系統代碼只能使用小寫英文、數字與連字號。");

  const supabase = await createClient();
  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    sort_order: parsed.data.sortOrder,
  };
  const result = parsed.data.id
    ? await supabase.from("categories").update(payload).eq("id", parsed.data.id)
    : await supabase.from("categories").insert({ ...payload, is_active: true });
  if (result.error) {
    console.error("[admin/categories] save failed", result.error.message);
    if (result.error.code === "23505") categoryRedirect("error", "這個分類系統代碼已存在，請換一組。");
    categoryRedirect("error", "分類尚未儲存，請稍後再試。");
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  categoryRedirect(parsed.data.id ? "updated" : "created");
}

export async function toggleCategoryAction(formData: FormData) {
  await requireCatalog();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const isActive = String(formData.get("isActive")) === "true";
  if (!id.success) categoryRedirect("error", "分類資料不正確。");

  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ is_active: !isActive }).eq("id", id.data);
  if (error) {
    console.error("[admin/categories] toggle failed", error.message);
    categoryRedirect("error", "分類狀態尚未更新。");
  }
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  categoryRedirect("updated");
}
