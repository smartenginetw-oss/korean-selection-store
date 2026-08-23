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
  category: "tops" | "bottoms" | "outerwear" | "accessories";
  status: "draft" | "active";
  salePrice: number;
  originalPrice: number | null;
  costPrice: number | null;
  options: { name: string; values: string[] }[];
  variants: {
    id: string;
    sku: string;
    stock: number;
    fulfillmentMode: "in_stock" | "preorder";
    options: Record<string, string>;
  }[];
  images: { id: string; url: string; storagePath: string; isPrimary: boolean; sortOrder: number }[];
};

export async function getAdminProductSummaries() {
  await requireCatalog();
  const supabase = await createClient();
  const productsResult = await supabase
    .from("products")
    .select("id,name,slug,status,sale_price,original_price")
    .order("created_at", { ascending: false });

  if (productsResult.error) {
    console.error("[admin/products] read failed", productsResult.error.message);
    return { products: [] as AdminProductSummary[], error: "商品資料目前無法讀取。" };
  }

  const rows = productsResult.data ?? [];
  if (!rows.length) return { products: [] as AdminProductSummary[], error: null };

  const variantsResult = await supabase
    .from("product_variants")
    .select("product_id,status,fulfillment_mode")
    .in("product_id", rows.map((row) => row.id));

  if (variantsResult.error) {
    console.error("[admin/products] variant read failed", variantsResult.error.message);
    return { products: [] as AdminProductSummary[], error: "商品規格目前無法讀取。" };
  }

  const variantsByProduct = new Map<string, { status: string; fulfillment_mode: string }[]>();
  for (const variant of variantsResult.data ?? []) {
    const current = variantsByProduct.get(variant.product_id) ?? [];
    current.push(variant);
    variantsByProduct.set(variant.product_id, current);
  }

  return {
    products: rows.map((row) => {
      const variants = (variantsByProduct.get(row.id) ?? []).filter((variant) => variant.status === "active");
      const hasStock = variants.some((variant) => variant.fulfillment_mode === "in_stock");
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
    .select("id,name,slug,description,status,sale_price,original_price,cost_price,tags")
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
    supabase.from("product_images").select("id,storage_path,sort_order,is_primary").eq("product_id", productId).order("is_primary", { ascending: false }).order("sort_order"),
  ]);

  const firstError = categoryResult.error ?? optionsResult.error ?? valuesResult.error ?? variantsResult.error ?? linksResult.error ?? inventoryResult.error ?? imagesResult.error;
  if (firstError) {
    console.error("[admin/products] editor detail read failed", firstError.message);
    return { product: null, error: "商品編輯資料目前無法讀取。" };
  }

  const categoryById = new Map([
    ["tops", "tops"],
    ["bottoms", "bottoms"],
    ["outerwear", "outerwear"],
    ["accessories", "accessories"],
  ]);
  const categoryId = categoryResult.data?.category_id;
  const categorySlugResult = categoryId ? await supabase.from("categories").select("slug").eq("id", categoryId).maybeSingle() : { data: null, error: null };
  const category = categoryById.get(categorySlugResult.data?.slug ?? "tops") as AdminProductEditorData["category"];
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
      status: productResult.data.status === "active" ? "active" as const : "draft" as const,
      salePrice: productResult.data.sale_price,
      originalPrice: productResult.data.original_price,
      costPrice: productResult.data.cost_price,
      options: optionsData,
      variants,
      images: (imagesResult.data ?? []).map((image) => ({
        id: image.id,
        storagePath: image.storage_path,
        url: supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl,
        isPrimary: image.is_primary,
        sortOrder: image.sort_order,
      })),
    } satisfies AdminProductEditorData,
    error: null,
  };
}
