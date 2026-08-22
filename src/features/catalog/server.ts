import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { products as mockProducts, type Product, type ProductCategory, type ProductOptionGroup, type ProductVariant } from "./data";

type ProductRow = Pick<
  Tables<"products">,
  "id" | "name" | "slug" | "description" | "original_price" | "sale_price" | "status" | "tags" | "published_at"
>;
type OptionRow = Pick<Tables<"product_options">, "id" | "product_id" | "name" | "position">;
type OptionValueRow = Pick<Tables<"product_option_values">, "id" | "option_id" | "value" | "position">;
type VariantRow = Pick<
  Tables<"product_variants">,
  "id" | "product_id" | "sku" | "status" | "price_override" | "fulfillment_mode" | "preorder_available_at"
>;
type VariantOptionRow = Pick<Tables<"variant_option_values">, "variant_id" | "option_value_id">;

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

function mapCategory(row: ProductRow): ProductCategory {
  const taggedCategory = row.tags.find((tag): tag is ProductCategory => ["tops", "bottoms", "outerwear", "accessories"].includes(tag));
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

function mapFulfillmentMode(mode: string): ProductVariant["availability"] {
  if (mode === "preorder" || mode === "unavailable") return mode;
  return "in_stock";
}

function mapProduct(
  row: ProductRow,
  optionsByProduct: Map<string, ProductOptionGroup[]>,
  variantsByProduct: Map<string, ProductVariant[]>,
): Product {
  const optionGroups = optionsByProduct.get(row.id) ?? [];
  const variants = variantsByProduct.get(row.id) ?? [];
  const colorGroup = optionGroups.find((group) => isColorOption(group.name));
  const sizeGroup = optionGroups.find((group) => isSizeOption(group.name));
  const fallbackGroups = optionGroups.length ? optionGroups : [];
  const colors = colorGroup?.values ?? fallbackGroups[0]?.values ?? [];
  const sizes = sizeGroup?.values ?? fallbackGroups[1]?.values ?? [];
  const availability = variants.some((variant) => variant.availability === "in_stock")
    ? "in_stock"
    : variants.some((variant) => variant.availability === "preorder")
      ? "preorder"
      : "in_stock";
  const preorderVariant = variants.find((variant) => variant.availability === "preorder");
  const badge = row.tags.includes("new") ? "NEW" : row.original_price ? "SALE" : undefined;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.sale_price,
    originalPrice: row.original_price ?? undefined,
    badge,
    availability,
    arrival: preorderVariant?.arrival,
    palette: PALETTES[row.slug] ?? ["#d8c5ae", "#9a8a79"],
    colors,
    sizes,
    description: row.description,
    category: mapCategory(row),
    optionGroups,
    variants,
  };
}

export async function getCatalog(): Promise<Product[]> {
  const client = getPublicClient();
  if (!client) return mockProducts;

  const [productsResult, optionsResult, valuesResult, variantsResult, linksResult] = await Promise.all([
    client
      .from("products")
      .select("id,name,slug,description,original_price,sale_price,status,tags,published_at")
      .eq("status", "active")
      .order("published_at", { ascending: false }),
    client.from("product_options").select("id,product_id,name,position").order("position"),
    client.from("product_option_values").select("id,option_id,value,position").order("position"),
    client
      .from("product_variants")
      .select("id,product_id,sku,status,price_override,fulfillment_mode,preorder_available_at")
      .eq("status", "active"),
    client.from("variant_option_values").select("variant_id,option_value_id"),
  ]);

  const error = productsResult.error ?? optionsResult.error ?? valuesResult.error ?? variantsResult.error ?? linksResult.error;
  if (error) {
    console.error("[catalog] Supabase read failed; using local fallback.", error.message);
    return mockProducts;
  }

  const productRows = (productsResult.data ?? []) as ProductRow[];
  if (!productRows.length) return [];

  const options = optionsResult.data as OptionRow[];
  const values = valuesResult.data as OptionValueRow[];
  const variants = variantsResult.data as VariantRow[];
  const links = linksResult.data as VariantOptionRow[];
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
      availability: mapFulfillmentMode(variant.fulfillment_mode),
      arrival: formatArrival(variant.preorder_available_at),
      options: selectedOptions,
    };
    const current = variantsByProduct.get(variant.product_id) ?? [];
    current.push(mapped);
    variantsByProduct.set(variant.product_id, current);
  }

  return productRows.map((row) => mapProduct(row, optionsByProduct, variantsByProduct));
}

export async function getProductBySlug(slug: string) {
  const catalog = await getCatalog();
  return catalog.find((product) => product.slug === slug);
}
