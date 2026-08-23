"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCatalog } from "@/lib/supabase/auth";
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

export type UpdateProductResult = CreateProductResult;

const ProductImagesSchema = z.object({
  productId: z.string().uuid(),
  images: z.array(z.object({
    path: z.string().trim().min(1).max(300),
    altText: z.string().trim().max(200),
    sortOrder: z.number().int().nonnegative().max(100),
  })).min(1).max(8),
});

export type RegisterProductImagesResult =
  | { ok: true; count: number }
  | { ok: false; message: string };

export async function createProductAction(payload: unknown): Promise<CreateProductResult> {
  await requireCatalog();

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

export async function updateProductAction(productId: string, payload: unknown): Promise<UpdateProductResult> {
  await requireCatalog();

  const parsedId = z.string().uuid().safeParse(productId);
  const parsed = ProductDraftSchema.safeParse(payload);
  if (!parsedId.success || !parsed.success) {
    return { ok: false, message: "商品資料格式不正確，請確認名稱、價格、規格與庫存。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_admin_product", {
    p_product_id: parsedId.data,
    p_payload: {
      ...parsed.data,
      originalPrice: parsed.data.originalPrice ?? null,
      costPrice: parsed.data.costPrice ?? null,
    },
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("[admin/products] update failed", error?.message ?? "empty response");
    if (error?.code === "23505") return { ok: false, message: "Slug 或 SKU 已存在，請換一組再儲存。" };
    if (error?.code === "42501") return { ok: false, message: "目前帳號沒有商品管理權限。" };
    if (error?.code === "P0002") return { ok: false, message: "找不到這項商品。" };
    if (error?.code === "22023") return { ok: false, message: error.message.includes("reserved") ? "庫存不可低於目前已保留數量。" : "商品資料驗證失敗，請確認規格與庫存。" };
    return { ok: false, message: "商品尚未更新，請稍後再試。" };
  }

  const product = data as { id?: unknown; slug?: unknown; name?: unknown };
  if (typeof product.id !== "string" || typeof product.slug !== "string" || typeof product.name !== "string") {
    return { ok: false, message: "商品回應格式不正確，請稍後再試。" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath(`/products/${product.slug}`);
  return { ok: true, product: { id: product.id, slug: product.slug, name: product.name } };
}

export async function registerProductImagesAction(payload: unknown): Promise<RegisterProductImagesResult> {
  await requireCatalog();

  const parsed = ProductImagesSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "圖片資料格式不正確。" };

  const supabase = await createClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,slug")
    .eq("id", parsed.data.productId)
    .maybeSingle();

  if (productError || !product) return { ok: false, message: "找不到要上傳圖片的商品。" };

  const pathPrefix = "products/" + parsed.data.productId + "/";
  const hasInvalidPath = parsed.data.images.some(({ path }) => (
    !path.startsWith(pathPrefix)
    || path.includes("..")
    || !/\.(jpg|jpeg|png|webp|avif)$/i.test(path)
  ));
  if (hasInvalidPath) return { ok: false, message: "圖片路徑不符合商品圖片規則。" };

  const { count, error: countError } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", parsed.data.productId);
  if (countError) {
    console.error("[admin/products] image count failed", countError.message);
    return { ok: false, message: "圖片目前無法儲存，請稍後再試。" };
  }

  const rows = parsed.data.images.map((image, index) => ({
    product_id: parsed.data.productId,
    storage_path: image.path,
    alt_text: image.altText,
    sort_order: image.sortOrder,
    is_primary: !count && index === 0,
  }));
  const { error } = await supabase.from("product_images").upsert(rows, { onConflict: "storage_path" });
  if (error) {
    console.error("[admin/products] image register failed", error.message);
    return { ok: false, message: "圖片目前無法儲存，請稍後再試。" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/products/" + product.slug);
  return { ok: true, count: rows.length };
}

const DeleteProductImageSchema = z.object({ productId: z.string().uuid(), imageId: z.string().uuid() });

export async function deleteProductImageAction(payload: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireCatalog();
  const parsed = DeleteProductImageSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "圖片資料格式不正確。" };

  const supabase = await createClient();
  const { data: image, error: imageError } = await supabase
    .from("product_images")
    .select("id,product_id,storage_path,is_primary")
    .eq("id", parsed.data.imageId)
    .eq("product_id", parsed.data.productId)
    .maybeSingle();
  if (imageError || !image) return { ok: false, message: "找不到這張商品圖片。" };

  const { error: deleteError } = await supabase.from("product_images").delete().eq("id", image.id);
  if (deleteError) {
    console.error("[admin/products] image delete failed", deleteError.message);
    return { ok: false, message: "圖片目前無法刪除，請稍後再試。" };
  }

  await supabase.storage.from("product-images").remove([image.storage_path]);
  if (image.is_primary) {
    const { data: nextImage } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", parsed.data.productId)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (nextImage) await supabase.from("product_images").update({ is_primary: true }).eq("id", nextImage.id);
  }

  const { data: product } = await supabase.from("products").select("slug").eq("id", parsed.data.productId).maybeSingle();
  revalidatePath("/admin/products");
  revalidatePath("/products");
  if (product?.slug) revalidatePath(`/products/${product.slug}`);
  return { ok: true };
}
