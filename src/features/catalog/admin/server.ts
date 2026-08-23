import { createClient } from "@/lib/supabase/server";

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

export async function getAdminProductSummaries() {
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
