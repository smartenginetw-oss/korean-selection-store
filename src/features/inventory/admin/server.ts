import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth";

export type AdminInventoryRow = {
  variantId: string;
  productName: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  updatedAt: string;
};

export async function getAdminInventory() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: inventory, error: inventoryError } = await supabase
    .from("inventory_levels")
    .select("variant_id,on_hand,reserved,low_stock_threshold,updated_at")
    .order("on_hand", { ascending: true })
    .limit(500);
  if (inventoryError) {
    console.error("[admin/inventory] read failed", inventoryError.message);
    return { rows: [] as AdminInventoryRow[], error: "庫存資料目前無法讀取。" };
  }

  const variantIds = (inventory ?? []).map((row) => row.variant_id);
  if (!variantIds.length) return { rows: [] as AdminInventoryRow[], error: null };

  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("id,sku,product_id")
    .in("id", variantIds);
  if (variantsError) {
    console.error("[admin/inventory] variant read failed", variantsError.message);
    return { rows: [] as AdminInventoryRow[], error: "商品規格目前無法讀取。" };
  }

  const productIds = [...new Set((variants ?? []).map((variant) => variant.product_id))];
  const { data: products, error: productsError } = await supabase.from("products").select("id,name").in("id", productIds);
  if (productsError) {
    console.error("[admin/inventory] product read failed", productsError.message);
    return { rows: [] as AdminInventoryRow[], error: "商品資料目前無法讀取。" };
  }

  const variantsById = new Map((variants ?? []).map((variant) => [variant.id, variant]));
  const productsById = new Map((products ?? []).map((product) => [product.id, product]));
  return {
    rows: (inventory ?? []).map((row) => {
      const variant = variantsById.get(row.variant_id);
      return {
        variantId: row.variant_id,
        productName: variant ? productsById.get(variant.product_id)?.name ?? "未命名商品" : "未命名商品",
        sku: variant?.sku ?? row.variant_id.slice(0, 8),
        onHand: row.on_hand,
        reserved: row.reserved,
        available: row.on_hand - row.reserved,
        lowStockThreshold: row.low_stock_threshold,
        updatedAt: row.updated_at,
      } satisfies AdminInventoryRow;
    }),
    error: null,
  };
}
