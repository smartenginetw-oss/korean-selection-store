"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCatalog } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const ProductDraftSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(5000),
  category: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
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

const ProductDetailsSchema = z.object({
  material: z.string().trim().max(2000),
  sizeGuide: z.string().trim().max(4000),
  modelInfo: z.string().trim().max(1000),
  origin: z.string().trim().max(200),
  careInstructions: z.string().trim().max(2000),
});

const ProductFinancialsSchema = z.object({
  rentCost: z.number().int().nonnegative().max(10000000),
  shippingCost: z.number().int().nonnegative().max(10000000),
  advertisingCost: z.number().int().nonnegative().max(10000000),
  packagingCost: z.number().int().nonnegative().max(10000000),
  otherOperatingCost: z.number().int().nonnegative().max(10000000),
});

export type CreateProductResult =
  | { ok: true; product: { id: string; slug: string; name: string } }
  | { ok: false; message: string };

export type UpdateProductResult = CreateProductResult;

const ProductTagsSchema = z.object({
  productId: z.string().uuid(),
  tags: z.array(z.string().trim().max(40)).max(12),
});

export type ProductTagsResult =
  | { ok: true; tags: string[] }
  | { ok: false; message: string };

export type ProductDetailsResult =
  | { ok: true }
  | { ok: false; message: string };

export type ProductFinancialsResult =
  | { ok: true }
  | { ok: false; message: string };

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

export async function updateProductTagsAction(payload: unknown): Promise<ProductTagsResult> {
  await requireCatalog();
  const parsed = ProductTagsSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "商品標籤格式不正確，最多可設定 12 個標籤。" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_admin_product_tags", {
    p_product_id: parsed.data.productId,
    p_tags: parsed.data.tags,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("[admin/products] tags update failed", error?.message ?? "empty response");
    if (error?.code === "42501") return { ok: false, message: "目前帳號沒有商品管理權限。" };
    if (error?.code === "P0002") return { ok: false, message: "找不到這項商品。" };
    if (error?.code === "22023") return { ok: false, message: error.message || "商品標籤格式不正確。" };
    return { ok: false, message: "商品標籤尚未更新，請稍後再試。" };
  }

  const result = data as { tags?: unknown };
  const tags = Array.isArray(result.tags) ? result.tags.filter((tag): tag is string => typeof tag === "string") : [];
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true, tags };
}

export async function updateProductDetailsAction(productId: string, payload: unknown): Promise<ProductDetailsResult> {
  await requireCatalog();

  const parsedId = z.string().uuid().safeParse(productId);
  const parsed = ProductDetailsSchema.safeParse(payload);
  if (!parsedId.success || !parsed.success) return { ok: false, message: "商品資訊格式不正確，請確認文字長度。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_admin_product_details", {
    p_product_id: parsedId.data,
    p_payload: parsed.data,
  });
  if (error) {
    console.error("[admin/products] details update failed", error.message);
    if (error.code === "42501") return { ok: false, message: "目前帳號沒有商品管理權限。" };
    if (error.code === "P0002") return { ok: false, message: "找不到這項商品。" };
    return { ok: false, message: "商品資訊尚未儲存，請稍後再試。" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true };
}

export async function updateProductFinancialsAction(productId: string, payload: unknown): Promise<ProductFinancialsResult> {
  await requireCatalog();
  const parsedId = z.string().uuid().safeParse(productId);
  const parsed = ProductFinancialsSchema.safeParse(payload);
  if (!parsedId.success || !parsed.success) return { ok: false, message: "營業費用格式不正確，請輸入非負整數。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_admin_product_financials", {
    p_product_id: parsedId.data,
    p_payload: parsed.data,
  });
  if (error) {
    console.error("[admin/products] financials update failed", error.message);
    if (error.code === "42501") return { ok: false, message: "目前帳號沒有商品管理權限。" };
    if (error.code === "P0002") return { ok: false, message: "找不到這項商品。" };
    return { ok: false, message: "營業費用尚未儲存，請稍後再試。" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true };
}

const ProductStatusSchema = z.object({
  productId: z.string().uuid(),
  status: z.enum(["draft", "active", "archived"]),
});

export async function setProductStatusAction(productId: string, status: string): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireCatalog();
  const parsed = ProductStatusSchema.safeParse({ productId, status });
  if (!parsed.success) return { ok: false, message: "商品狀態資料不正確。" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_admin_product_status", {
    p_product_id: parsed.data.productId,
    p_status: parsed.data.status,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("[admin/products] status update failed", error?.message ?? "empty response");
    if (error?.code === "42501") return { ok: false, message: "目前帳號沒有商品管理權限。" };
    if (error?.code === "P0002") return { ok: false, message: "找不到這項商品。" };
    return { ok: false, message: "商品狀態尚未更新，請稍後再試。" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true };
}

const DeleteProductSchema = z.object({ productId: z.string().uuid() });

export async function deleteProductAction(productId: string): Promise<{ ok: true; productName: string } | { ok: false; message: string }> {
  await requireCatalog();
  const parsed = DeleteProductSchema.safeParse({ productId });
  if (!parsed.success) return { ok: false, message: "商品資料不正確。" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_admin_product", { p_product_id: parsed.data.productId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("[admin/products] delete failed", error?.message ?? "empty response");
    if (error?.code === "42501") return { ok: false, message: "目前帳號沒有商品刪除權限。" };
    if (error?.code === "P0002") return { ok: false, message: "找不到這項商品。" };
    if (error?.code === "P0001") return { ok: false, message: "只有草稿或封存商品可以刪除，請先封存商品。" };
    if (error?.code === "23503") return { ok: false, message: "這項商品已有訂單或庫存紀錄，請改用封存。" };
    return { ok: false, message: "商品目前無法刪除，請稍後再試。" };
  }

  const result = data as { productName?: unknown; storagePaths?: unknown };
  const storagePaths = Array.isArray(result.storagePaths)
    ? result.storagePaths.filter((path): path is string => typeof path === "string" && path.length > 0)
    : [];
  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage.from("product-images").remove(storagePaths);
    if (storageError) console.error("[admin/products] deleted product image cleanup failed", storageError.message);
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true, productName: typeof result.productName === "string" ? result.productName : "商品" };
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

const UpdateProductImageSchema = z.object({
  productId: z.string().uuid(),
  imageId: z.string().uuid(),
  altText: z.string().trim().max(200),
  sortOrder: z.number().int().nonnegative().max(100),
  isPrimary: z.boolean(),
});

export async function updateProductImageAction(payload: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireCatalog();
  const parsed = UpdateProductImageSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "圖片設定格式不正確。" };

  const supabase = await createClient();
  const { data: image, error: imageError } = await supabase
    .from("product_images")
    .select("id,product_id")
    .eq("id", parsed.data.imageId)
    .eq("product_id", parsed.data.productId)
    .maybeSingle();
  if (imageError || !image) return { ok: false, message: "找不到這張商品圖片。" };

  if (parsed.data.isPrimary) {
    const { error: clearError } = await supabase.from("product_images").update({ is_primary: false }).eq("product_id", parsed.data.productId);
    if (clearError) {
      console.error("[admin/products] image primary reset failed", clearError.message);
      return { ok: false, message: "主圖設定尚未更新，請稍後再試。" };
    }
  }
  const { error } = await supabase.from("product_images").update({
    alt_text: parsed.data.altText,
    sort_order: parsed.data.sortOrder,
    is_primary: parsed.data.isPrimary,
  }).eq("id", parsed.data.imageId);
  if (error) {
    console.error("[admin/products] image update failed", error.message);
    return { ok: false, message: "圖片設定尚未更新，請稍後再試。" };
  }

  const { data: product } = await supabase.from("products").select("slug").eq("id", parsed.data.productId).maybeSingle();
  revalidatePath("/admin/products");
  revalidatePath("/products");
  if (product?.slug) revalidatePath(`/products/${product.slug}`);
  return { ok: true };
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
