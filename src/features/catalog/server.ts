import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { type Product, type ProductCategory, type ProductOptionGroup, type ProductVariant } from "./data";

type ProductRow = Pick<
  Tables<"products">,
  "id" | "name" | "slug" | "description" | "material" | "size_guide" | "model_info" | "origin" | "care_instructions" | "original_price" | "sale_price" | "status" | "tags" | "published_at"
>;
type OptionRow = Pick<Tables<"product_options">, "id" | "product_id" | "name" | "position">;
type OptionValueRow = Pick<Tables<"product_option_values">, "id" | "option_id" | "value" | "position">;
type VariantRow = Pick<
  Tables<"product_variants">,
  "id" | "product_id" | "sku" | "status" | "price_override" | "fulfillment_mode" | "preorder_available_at"
>;
type VariantOptionRow = Pick<Tables<"variant_option_values">, "variant_id" | "option_value_id">;
type ImageRow = Pick<Tables<"product_images">, "product_id" | "storage_path" | "sort_order" | "is_primary">;
type ProductCategoryLinkRow = Pick<Tables<"product_categories">, "product_id" | "category_id" | "is_primary">;
type CategoryRow = Pick<Tables<"categories">, "id" | "name" | "slug" | "is_active" | "sort_order">;
type PublicVariantAvailabilityRow = { variant_id: string; is_available: boolean };
type PublicBestSellerRow = { product_id: string; sold_quantity: number };

export type PublicVariantStatus = {
  variantId: string;
  productId: string;
  price: number;
  availability: ProductVariant["availability"];
  arrival?: string;
};

const PALETTES: Record<string, [string, string]> = {
  "soft-oversize-knit": ["#d8c5ae", "#9a8a79"],
  "daily-soft-shirt": ["#ddd6ca", "#adb3aa"],
  "half-moon-bag": ["#b4a294", "#756b63"],
  "calm-pleated-trousers": ["#b8b1a8", "#77716c"],
};

const CATEGORY_BY_SLUG: Record<string, ProductCategory> = {
  "soft-oversize-knit": "tops",
  "daily-soft-shirt": "tops",
  "half-moon-bag": "accessories",
  "calm-pleated-skirt": "bottoms",
  "calm-pleated-trousers": "bottoms",
};

const legacyCategorySlugs = new Set(["tops", "bottoms", "outerwear", "accessories"]);

function mapCategory(row: ProductRow, linkedCategory?: string): ProductCategory {
  if (linkedCategory) return linkedCategory;
  const taggedCategory = row.tags.find((tag) => legacyCategorySlugs.has(tag));
  return taggedCategory ?? CATEGORY_BY_SLUG[row.slug] ?? "tops";
}

function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function formatArrival(date: string | null) {
  if (!date) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  const day = parsed.getUTCDate();
  const period = day <= 10 ? "上旬" : day <= 20 ? "中旬" : "下旬";
  return `${parsed.getUTCMonth() + 1} 月${period}`;
}

function isColorOption(name: string) {
  return ["color", "colour", "顏色", "色系"].includes(name.trim().toLowerCase());
}

function isSizeOption(name: string) {
  return ["size", "尺寸", "尺碼"].includes(name.trim().toLowerCase());
}

function mapVariantAvailability(mode: string, isAvailable: boolean): ProductVariant["availability"] {
  if (mode === "preorder") return "preorder";
  if (mode === "unavailable" || !isAvailable) return "unavailable";
  return "in_stock";
}

function mapProduct(
  row: ProductRow,
  optionsByProduct: Map<string, ProductOptionGroup[]>,
  variantsByProduct: Map<string, ProductVariant[]>,
  imagesByProduct: Map<string, string[]>,
  categoryByProduct: Map<string, string>,
  soldQuantityByProduct: Map<string, number>,
): Product {
  const optionGroups = optionsByProduct.get(row.id) ?? [];
  const variants = variantsByProduct.get(row.id) ?? [];
  const colorGroup = optionGroups.find((group) => isColorOption(group.name));
  const sizeGroup = optionGroups.find((group) => isSizeOption(group.name));
  const fallbackGroups = optionGroups.length ? optionGroups : [];
  const colors = colorGroup?.values ?? fallbackGroups[0]?.values ?? [];
  const sizes = sizeGroup?.values ?? fallbackGroups[1]?.values ?? [];
  const hasInStock = variants.some((variant) => variant.availability === "in_stock");
  const hasPreorder = variants.some((variant) => variant.availability === "preorder");
  const availability = hasInStock && hasPreorder
    ? "mixed"
    : hasInStock
      ? "in_stock"
      : hasPreorder
        ? "preorder"
        : "unavailable";
  const isAvailable = variants.some((variant) => variant.availability !== "unavailable");
  const preorderVariant = variants.find((variant) => variant.availability === "preorder");
  const badge = row.tags.includes("new") ? "NEW" : row.tags.includes("sale") || row.original_price ? "SALE" : undefined;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.sale_price,
    originalPrice: row.original_price ?? undefined,
    badge,
    availability,
    isAvailable,
    soldQuantity: soldQuantityByProduct.get(row.id) ?? 0,
    arrival: preorderVariant?.arrival,
    images: imagesByProduct.get(row.id) ?? [],
    palette: PALETTES[row.slug] ?? ["#d8c5ae", "#9a8a79"],
    colors,
    sizes,
    description: row.description,
    material: row.material ?? undefined,
    sizeGuide: row.size_guide ?? undefined,
    modelInfo: row.model_info ?? undefined,
    origin: row.origin ?? undefined,
    careInstructions: row.care_instructions ?? undefined,
    category: mapCategory(row, categoryByProduct.get(row.id)),
    optionGroups,
    variants,
  };
}

export async function getCatalog(): Promise<Product[]> {
  const client = getPublicClient();
  if (!client) return [];

  const [productsResult, optionsResult, valuesResult, variantsResult, linksResult, imagesResult, categoryLinksResult, categoriesResult] = await Promise.all([
    client
      .from("products")
      .select("id,name,slug,description,material,size_guide,model_info,origin,care_instructions,original_price,sale_price,status,tags,published_at")
      .eq("status", "active")
      .order("published_at", { ascending: false }),
    client.from("product_options").select("id,product_id,name,position").order("position"),
    client.from("product_option_values").select("id,option_id,value,position").order("position"),
    client
      .from("product_variants")
      .select("id,product_id,sku,status,price_override,fulfillment_mode,preorder_available_at")
      .eq("status", "active"),
    client.from("variant_option_values").select("variant_id,option_value_id"),
    client
      .from("product_images")
      .select("product_id,storage_path,sort_order,is_primary")
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true }),
    client.from("product_categories").select("product_id,category_id,is_primary").eq("is_primary", true),
    client.from("categories").select("id,name,slug,is_active,sort_order").eq("is_active", true).order("sort_order").order("name"),
  ]);

  const error = productsResult.error ?? optionsResult.error ?? valuesResult.error ?? variantsResult.error ?? linksResult.error ?? imagesResult.error ?? categoryLinksResult.error ?? categoriesResult.error;
  if (error) {
    console.error("[catalog] Supabase read failed; returning an empty catalog.", error.message);
    return [];
  }

  const productRows = (productsResult.data ?? []) as ProductRow[];
  if (!productRows.length) return [];

  const options = optionsResult.data as OptionRow[];
  const values = valuesResult.data as OptionValueRow[];
  const variants = variantsResult.data as VariantRow[];
  const availabilityResult = variants.length
    ? await client.rpc("get_public_variant_availability", { p_variant_ids: variants.map((variant) => variant.id) })
    : { data: [], error: null };
  if (availabilityResult.error) {
    console.error("[catalog] public availability read failed; returning an empty catalog.", availabilityResult.error.message);
    return [];
  }
  const availabilityRows = (availabilityResult.data ?? []) as PublicVariantAvailabilityRow[];
  const availabilityByVariant = new Map(availabilityRows.map((row) => [row.variant_id, row.is_available]));
  const bestSellersResult = await client.rpc("get_public_best_sellers", { p_limit: 48 });
  if (bestSellersResult.error) {
    console.error("[catalog] public best-seller read failed; continuing without sales ranking.", bestSellersResult.error.message);
  }
  const bestSellerRows = (bestSellersResult.data ?? []) as PublicBestSellerRow[];
  const soldQuantityByProduct = new Map(bestSellerRows.map((row) => [row.product_id, Number(row.sold_quantity) || 0]));
  const links = linksResult.data as VariantOptionRow[];
  const images = (imagesResult.data ?? []) as ImageRow[];
  const categoryRows = (categoriesResult.data ?? []) as CategoryRow[];
  const categoryLinks = (categoryLinksResult.data ?? []) as ProductCategoryLinkRow[];
  const categorySlugById = new Map(categoryRows.map((category) => [category.id, category.slug]));
  const categoryByProduct = new Map<string, string>();
  for (const link of categoryLinks) {
    const slug = categorySlugById.get(link.category_id);
    if (slug) categoryByProduct.set(link.product_id, slug);
  }
  const optionById = new Map(options.map((option) => [option.id, option]));
  const valueById = new Map(values.map((value) => [value.id, value]));
  const linksByVariant = new Map<string, string[]>();

  for (const link of links) {
    const current = linksByVariant.get(link.variant_id) ?? [];
    current.push(link.option_value_id);
    linksByVariant.set(link.variant_id, current);
  }

  const optionsByProduct = new Map<string, ProductOptionGroup[]>();
  for (const option of options) {
    const current = optionsByProduct.get(option.product_id) ?? [];
    current.push({
      name: option.name,
      values: values
        .filter((value) => value.option_id === option.id)
        .sort((a, b) => a.position - b.position)
        .map((value) => value.value),
    });
    optionsByProduct.set(option.product_id, current);
  }

  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const variant of variants) {
    const selectedOptions: Record<string, string> = {};
    for (const optionValueId of linksByVariant.get(variant.id) ?? []) {
      const value = valueById.get(optionValueId);
      const option = value ? optionById.get(value.option_id) : undefined;
      if (value && option) selectedOptions[option.name] = value.value;
    }

    const mapped: ProductVariant = {
      id: variant.id,
      sku: variant.sku,
      price: variant.price_override ?? productRows.find((product) => product.id === variant.product_id)?.sale_price ?? 0,
      availability: mapVariantAvailability(variant.fulfillment_mode, availabilityByVariant.get(variant.id) === true),
      arrival: formatArrival(variant.preorder_available_at),
      options: selectedOptions,
    };
    const current = variantsByProduct.get(variant.product_id) ?? [];
    current.push(mapped);
    variantsByProduct.set(variant.product_id, current);
  }

  const imagesByProduct = new Map<string, string[]>();
  for (const image of images.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)) {
    const publicUrl = client.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl;
    const current = imagesByProduct.get(image.product_id) ?? [];
    current.push(publicUrl);
    imagesByProduct.set(image.product_id, current);
  }

  return productRows.map((row) => mapProduct(row, optionsByProduct, variantsByProduct, imagesByProduct, categoryByProduct, soldQuantityByProduct));
}

export type PublicCategory = { slug: string; name: string };

export async function getPublicCategories(): Promise<PublicCategory[]> {
  const client = getPublicClient();
  if (!client) return [];
  const { data, error } = await client
    .from("categories")
    .select("slug,name")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) {
    console.error("[catalog] category read failed; returning no categories.", error.message);
    return [];
  }
  return (data ?? []).map((category) => ({ slug: category.slug, name: category.name }));
}

/**
 * Re-checks only the public, customer-safe state needed by a persisted cart.
 * Inventory quantities stay behind the availability RPC and are never returned.
 */
export async function getPublicVariantStatuses(variantIds: string[]): Promise<PublicVariantStatus[] | null> {
  const client = getPublicClient();
  if (!client || !variantIds.length) return client ? [] : null;

  const { data: variantData, error: variantError } = await client
    .from("product_variants")
    .select("id,product_id,price_override,fulfillment_mode,preorder_available_at")
    .eq("status", "active")
    .in("id", variantIds);
  if (variantError) {
    console.error("[catalog] public cart availability read failed; returning no statuses.", variantError.message);
    return null;
  }

  const variants = (variantData ?? []) as Array<Pick<VariantRow, "id" | "product_id" | "price_override" | "fulfillment_mode" | "preorder_available_at">>;
  if (!variants.length) return [];

  const productIds = [...new Set(variants.map((variant) => variant.product_id))];
  const { data: productData, error: productError } = await client
    .from("products")
    .select("id,sale_price,status")
    .eq("status", "active")
    .in("id", productIds);
  if (productError) {
    console.error("[catalog] public cart product read failed; returning no statuses.", productError.message);
    return null;
  }

  const activeProducts = new Map((productData ?? []).map((product) => [product.id, product.sale_price]));
  const activeVariants = variants.filter((variant) => activeProducts.has(variant.product_id));
  if (!activeVariants.length) return [];

  const availabilityResult = await client.rpc("get_public_variant_availability", { p_variant_ids: activeVariants.map((variant) => variant.id) });
  if (availabilityResult.error) {
    console.error("[catalog] public cart availability RPC failed; returning no statuses.", availabilityResult.error.message);
    return null;
  }
  const availabilityByVariant = new Map(((availabilityResult.data ?? []) as PublicVariantAvailabilityRow[]).map((row) => [row.variant_id, row.is_available]));

  return activeVariants.map((variant) => ({
    variantId: variant.id,
    productId: variant.product_id,
    price: variant.price_override ?? activeProducts.get(variant.product_id) ?? 0,
    availability: mapVariantAvailability(variant.fulfillment_mode, availabilityByVariant.get(variant.id) === true),
    arrival: formatArrival(variant.preorder_available_at),
  }));
}

export async function getProductBySlug(slug: string) {
  const catalog = await getCatalog();
  return catalog.find((product) => product.slug === slug);
}
