"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const ProductDraftSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(5000),
  category: z.enum(["tops", "bottoms", "outerwear", "accessories"]),
  status: z.enum(["draft", "active"]),
  salePrice: z.number().int().positive(),
  originalPrice: z.number().int().nonnegative().nullable(),
  costPrice: z.number().int().nonnegative().nullable(),
  options: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    values: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
  })).min(1).max(10),
  variants: z.array(z.object({
    sku: z.string().trim().min(1).max(80),
    fulfillmentMode: z.enum(["in_stock", "preorder"]),
    stock: z.number().int().nonnegative().max(100000),
    options: z.record(z.string(), z.string().trim().min(1).max(80)),
  })).min(1).max(500),
});

export type CreateProductResult =
  | { ok: true; product: { id: string; slug: string; name: string } }
  | { ok: false; message: string };

export async function createProductAction(payload: unknown): Promise<CreateProductResult> {
  await requireAdmin();

  const parsed = ProductDraftSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: "商品資料格式不正確，請確認名稱、價格、規格與庫存。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_admin_product", {
    p_payload: {
      ...parsed.data,
      originalPrice: parsed.data.originalPrice ?? null,
      costPrice: parsed.data.costPrice ?? null,
    },
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("[admin/products] create failed", error?.message ?? "empty response");
    if (error?.code === "23505") return { ok: false, message: "Slug 或 SKU 已存在，請換一組再儲存。" };
    if (error?.code === "42501") return { ok: false, message: "目前帳號沒有商品管理權限。" };
    return { ok: false, message: "商品尚未儲存，請稍後再試。" };
  }

  const product = data as { id?: unknown; slug?: unknown; name?: unknown };
  if (typeof product.id !== "string" || typeof product.slug !== "string" || typeof product.name !== "string") {
    return { ok: false, message: "商品回應格式不正確，請稍後再試。" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  if (parsed.data.status === "active") revalidatePath(`/products/${product.slug}`);
  return { ok: true, product: { id: product.id, slug: product.slug, name: product.name } };
}
