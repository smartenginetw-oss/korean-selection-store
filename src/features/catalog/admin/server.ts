import { createClient } from "@/lib/supabase/server";
import { requireCatalog } from "@/lib/supabase/auth";

export type AdminProductSummary = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "archived";
  salePrice: number;
  originalPrice: number | null;
  variantCount: number;
  availability: "in_stock" | "preorder" | "mixed" | "unavailable";
};

export type AdminProductEditorData = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  status: "draft" | "active" | "archived";
  tags: string[];
  salePrice: number;
  originalPrice: number | null;
  costPrice: number | null;
  allocatedRentCost: number;
  allocatedShippingCost: number;
  allocatedAdCost: number;
  allocatedPackagingCost: number;
  allocatedOtherCost: number;
  material: string | null;
  sizeGuide: string | null;
  modelInfo: string | null;
  origin: string | null;
  careInstructions: string | null;
  options: { name: string; values: string[] }[];
  variants: {
    id: string;
    sku: string;
    stock: number;
    fulfillmentMode: "in_stock" | "preorder";
    options: Record<string, string>;
  }[];
  images: { id: string; url: string; storagePath: string; altText: string; isPrimary: boolean; sortOrder: number }[];
};

export type AdminCategoryOption = { id: string; name: string; slug: string };

export async function getAdminCategories() {
  await requireCatalog();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) {
    console.error("[admin/categories] options read failed", error.message);
    return [] as AdminCategoryOption[];
  }
  return (data ?? []) as AdminCategoryOption[];
}

const adminProductStatuses = ["draft", "active", "archived"] as const;
export type AdminProductStatusFilter = (typeof adminProductStatuses)[number];

export function parseAdminProductStatus(value: string | undefined) {
  return value && adminProductStatuses.includes(value as AdminProductStatusFilter)
    ? value as AdminProductStatusFilter
    : undefined;
}

export async function getAdminProductSummaries(filters: { query?: string; status?: AdminProductStatusFilter } = {}) {
  await requireCatalog();
  const supabase = await createClient();
  let productsQuery = supabase
    .from("products")
    .select("id,name,slug,status,sale_price,original_price")
    .order("created_at", { ascending: false });

  if (filters.status) productsQuery = productsQuery.eq("status", filters.status);
  const query = filters.query?.trim().slice(0, 80).replace(/[%,_\\()]/g, "") ?? "";
  if (query) productsQuery = productsQuery.or(`name.ilike.%${query}%,slug.ilike.%${query}%`);

  const productsResult = await productsQuery;

  if (productsResult.error) {
    console.error("[admin/products] read failed", productsResult.error.message);
    return { products: [] as AdminProductSummary[], error: "商品資料目前無法讀取。" };
  }

  const rows = productsResult.data ?? [];
  if (!rows.length) return { products: [] as AdminProductSummary[], error: null };

  const variantsResult = await supabase
    .from("product_variants")
    .select("id,product_id,status,fulfillment_mode")
    .in("product_id", rows.map((row) => row.id));

  if (variantsResult.error) {
    console.error("[admin/products] variant read failed", variantsResult.error.message);
    return { products: [] as AdminProductSummary[], error: "商品規格目前無法讀取。" };
  }

  const variants = variantsResult.data ?? [];
  const variantIds = variants.map((variant) => variant.id);
  const inventoryResult = variantIds.length
    ? await supabase
      .from("inventory_levels")
      .select("variant_id,on_hand,reserved")
      .in("variant_id", variantIds)
    : { data: [], error: null };

  if (inventoryResult.error) {
    console.error("[admin/products] inventory availability read failed", inventoryResult.error.message);
    return { products: [] as AdminProductSummary[], error: "商品庫存狀態目前無法讀取。" };
  }

  const inventoryByVariant = new Map(
    (inventoryResult.data ?? []).map((inventory) => [
      inventory.variant_id,
      Math.max(0, (inventory.on_hand ?? 0) - (inventory.reserved ?? 0)),
    ]),
  );
  const variantsByProduct = new Map<string, { id: string; status: string; fulfillment_mode: string }[]>();
  for (const variant of variants) {
    const current = variantsByProduct.get(variant.product_id) ?? [];
    current.push(variant);
    variantsByProduct.set(variant.product_id, current);
  }

  return {
    products: rows.map((row) => {
      const variants = (variantsByProduct.get(row.id) ?? []).filter((variant) => variant.status === "active");
      // Keep this rule aligned with the public catalog: in-stock variants are
      // purchasable only when on-hand minus reserved inventory is positive;
      // preorder variants remain purchasable while the preorder flag is on.
      const hasStock = variants.some((variant) =>
        variant.fulfillment_mode === "in_stock" && (inventoryByVariant.get(variant.id) ?? 0) > 0,
      );
      const hasPreorder = variants.some((variant) => variant.fulfillment_mode === "preorder");
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status as AdminProductSummary["status"],
        salePrice: row.sale_price,
        originalPrice: row.original_price,
        variantCount: variants.length,
        availability: hasStock && hasPreorder ? "mixed" : hasStock ? "in_stock" : hasPreorder ? "preorder" : "unavailable",
      } satisfies AdminProductSummary;
    }),
    error: null,
  };
}

export async function getAdminProductEditorData(productId: string) {
  await requireCatalog();
  const supabase = await createClient();
  const productResult = await supabase
    .from("products")
    .select("id,name,slug,description,status,sale_price,original_price,cost_price,allocated_rent_cost,allocated_shipping_cost,allocated_ad_cost,allocated_packaging_cost,allocated_other_cost,material,size_guide,model_info,origin,care_instructions,tags")
    .eq("id", productId)
    .maybeSingle();

  if (productResult.error || !productResult.data) {
    if (productResult.error) console.error("[admin/products] editor read failed", productResult.error.message);
    return { product: null, error: "找不到這項商品，或商品資料目前無法讀取。" };
  }

  const [categoryResult, optionsResult, valuesResult, variantsResult, linksResult, inventoryResult, imagesResult] = await Promise.all([
    supabase.from("product_categories").select("category_id,is_primary").eq("product_id", productId).eq("is_primary", true).maybeSingle(),
    supabase.from("product_options").select("id,name,position").eq("product_id", productId).order("position"),
    supabase.from("product_option_values").select("id,option_id,value,position").order("position"),
    supabase.from("product_variants").select("id,sku,status,fulfillment_mode").eq("product_id", productId).order("created_at"),
    supabase.from("variant_option_values").select("variant_id,option_value_id"),
    supabase.from("inventory_levels").select("variant_id,on_hand,reserved").in("variant_id", (await supabase.from("product_variants").select("id").eq("product_id", productId)).data?.map((row) => row.id) ?? []),
    supabase.from("product_images").select("id,storage_path,alt_text,sort_order,is_primary").eq("product_id", productId).order("is_primary", { ascending: false }).order("sort_order"),
  ]);

  const firstError = categoryResult.error ?? optionsResult.error ?? valuesResult.error ?? variantsResult.error ?? linksResult.error ?? inventoryResult.error ?? imagesResult.error;
  if (firstError) {
    console.error("[admin/products] editor detail read failed", firstError.message);
    return { product: null, error: "商品編輯資料目前無法讀取。" };
  }

  const categoryId = categoryResult.data?.category_id;
  const categorySlugResult = categoryId ? await supabase.from("categories").select("slug").eq("id", categoryId).maybeSingle() : { data: null, error: null };
  const category = categorySlugResult.data?.slug ?? "tops";
  const options = optionsResult.data ?? [];
  const values = valuesResult.data ?? [];
  const optionById = new Map(options.map((option) => [option.id, option]));
  const optionsData = options.map((option) => ({
    name: option.name,
    values: values.filter((value) => value.option_id === option.id).sort((a, b) => a.position - b.position).map((value) => value.value),
  }));
  const valueById = new Map(values.map((value) => [value.id, value]));
  const linksByVariant = new Map<string, string[]>();
  for (const link of linksResult.data ?? []) {
    linksByVariant.set(link.variant_id, [...(linksByVariant.get(link.variant_id) ?? []), link.option_value_id]);
  }
  const inventoryByVariant = new Map((inventoryResult.data ?? []).map((row) => [row.variant_id, row]));
  const variants = (variantsResult.data ?? [])
    .filter((variant) => variant.status !== "archived")
    .map((variant) => {
      const selectedOptions: Record<string, string> = {};
      for (const valueId of linksByVariant.get(variant.id) ?? []) {
        const value = valueById.get(valueId);
        const option = value ? optionById.get(value.option_id) : undefined;
        if (value && option) selectedOptions[option.name] = value.value;
      }
      return {
        id: variant.id,
        sku: variant.sku,
        stock: inventoryByVariant.get(variant.id)?.on_hand ?? 0,
        fulfillmentMode: variant.fulfillment_mode === "preorder" ? "preorder" as const : "in_stock" as const,
        options: selectedOptions,
      };
    });

  return {
    product: {
      id: productResult.data.id,
      name: productResult.data.name,
      slug: productResult.data.slug,
      description: productResult.data.description,
      category,
      status: productResult.data.status === "active"
        ? "active" as const
        : productResult.data.status === "archived"
          ? "archived" as const
          : "draft" as const,
      tags: productResult.data.tags ?? [],
      salePrice: productResult.data.sale_price,
      originalPrice: productResult.data.original_price,
      costPrice: productResult.data.cost_price,
      allocatedRentCost: productResult.data.allocated_rent_cost,
      allocatedShippingCost: productResult.data.allocated_shipping_cost,
      allocatedAdCost: productResult.data.allocated_ad_cost,
      allocatedPackagingCost: productResult.data.allocated_packaging_cost,
      allocatedOtherCost: productResult.data.allocated_other_cost,
      material: productResult.data.material,
      sizeGuide: productResult.data.size_guide,
      modelInfo: productResult.data.model_info,
      origin: productResult.data.origin,
      careInstructions: productResult.data.care_instructions,
      options: optionsData,
      variants,
      images: (imagesResult.data ?? []).map((image) => ({
        id: image.id,
        storagePath: image.storage_path,
        altText: image.alt_text,
        url: supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl,
        isPrimary: image.is_primary,
        sortOrder: image.sort_order,
      })),
    } satisfies AdminProductEditorData,
    error: null,
  };
}
