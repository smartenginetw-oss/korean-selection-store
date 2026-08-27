import { createClient } from "@/lib/supabase/server";
import { requireInventory } from "@/lib/supabase/auth";

export type AdminInventoryRow = {
  variantId: string;
  productName: string;
  sku: string;
  fulfillmentMode: "in_stock" | "preorder";
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  updatedAt: string;
};

export type AdminInventoryMovement = {
  id: string;
  variantId: string;
  productName: string;
  sku: string;
  orderLabel: string;
  type: string;
  quantityDelta: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
};

export type AdminInventoryFilters = {
  start?: string;
  end?: string;
  q?: string;
};

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function nextDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

export async function getAdminInventory(movementLimit = 100, filters: AdminInventoryFilters = {}) {
  await requireInventory();
  const supabase = await createClient();
  const { data: inventory, error: inventoryError } = await supabase
    .from("inventory_levels")
    .select("variant_id,on_hand,reserved,low_stock_threshold,updated_at")
    .order("on_hand", { ascending: true })
    .limit(500);
  if (inventoryError) {
    console.error("[admin/inventory] read failed", inventoryError.message);
    return { rows: [] as AdminInventoryRow[], movements: [] as AdminInventoryMovement[], movementError: null, error: "庫存資料目前無法讀取。" };
  }

  const variantIds = (inventory ?? []).map((row) => row.variant_id);
  if (!variantIds.length) return { rows: [] as AdminInventoryRow[], movements: [] as AdminInventoryMovement[], movementError: null, error: null };

  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("id,sku,product_id,fulfillment_mode")
    .in("id", variantIds);
  if (variantsError) {
    console.error("[admin/inventory] variant read failed", variantsError.message);
    return { rows: [] as AdminInventoryRow[], movements: [] as AdminInventoryMovement[], movementError: null, error: "商品規格目前無法讀取。" };
  }

  const productIds = [...new Set((variants ?? []).map((variant) => variant.product_id))];
  const { data: products, error: productsError } = await supabase.from("products").select("id,name").in("id", productIds);
  if (productsError) {
    console.error("[admin/inventory] product read failed", productsError.message);
    return { rows: [] as AdminInventoryRow[], movements: [] as AdminInventoryMovement[], movementError: null, error: "商品資料目前無法讀取。" };
  }

  const variantsById = new Map((variants ?? []).map((variant) => [variant.id, variant]));
  const productsById = new Map((products ?? []).map((product) => [product.id, product]));
  const start = validDate(filters.start);
  const end = validDate(filters.end);
  let movementQuery = supabase
    .from("inventory_movements")
    .select("id,variant_id,order_id,type,quantity_delta,balance_after,reason,created_at")
    .in("variant_id", variantIds)
    .order("created_at", { ascending: false });
  if (start) movementQuery = movementQuery.gte("created_at", `${start}T00:00:00+08:00`);
  if (end) movementQuery = movementQuery.lt("created_at", `${nextDate(end)}T00:00:00+08:00`);
  const { data: movementRows, error: movementError } = await movementQuery.limit(Math.min(Math.max(movementLimit, 1), 5000));
  if (movementError) console.error("[admin/inventory] movement read failed", movementError.message);

  const orderIds = [...new Set((movementRows ?? []).map((movement) => movement.order_id).filter((orderId): orderId is string => Boolean(orderId)))];
  const { data: orders } = orderIds.length
    ? await supabase.from("orders").select("id,order_number").in("id", orderIds)
    : { data: [] as { id: string; order_number: string }[] };
  const ordersById = new Map((orders ?? []).map((order) => [order.id, order.order_number]));
  const productNameByVariantId = new Map(
    (variants ?? []).map((variant) => [variant.id, productsById.get(variant.product_id)?.name ?? "未命名商品"]),
  );
  const skuByVariantId = new Map((variants ?? []).map((variant) => [variant.id, variant.sku]));

  const search = filters.q?.trim().toLocaleLowerCase("zh-TW");
  const movements = (movementRows ?? []).map((movement) => ({
    id: movement.id,
    variantId: movement.variant_id,
    productName: productNameByVariantId.get(movement.variant_id) ?? "未命名商品",
    sku: skuByVariantId.get(movement.variant_id) ?? movement.variant_id.slice(0, 8),
    orderLabel: movement.order_id ? ordersById.get(movement.order_id) ?? `訂單 ${movement.order_id.slice(0, 8)}` : "非訂單異動",
    type: movement.type,
    quantityDelta: movement.quantity_delta,
    balanceAfter: movement.balance_after,
    reason: movement.reason,
    createdAt: movement.created_at,
  } satisfies AdminInventoryMovement)).filter((movement) => {
    if (!search) return true;
    return [movement.productName, movement.sku, movement.orderLabel, movement.type, movement.reason ?? ""].some((value) => value.toLocaleLowerCase("zh-TW").includes(search));
  });

  return {
    rows: (inventory ?? []).map((row) => {
      const variant = variantsById.get(row.variant_id);
      return {
        variantId: row.variant_id,
        productName: variant ? productsById.get(variant.product_id)?.name ?? "未命名商品" : "未命名商品",
        sku: variant?.sku ?? row.variant_id.slice(0, 8),
        fulfillmentMode: variant?.fulfillment_mode === "preorder" ? "preorder" : "in_stock",
        onHand: row.on_hand,
        reserved: row.reserved,
        // Public catalog availability is boolean and treats non-positive
        // on-hand minus reserved as unavailable. Keep the admin number aligned
        // and avoid exposing a negative "可售" quantity.
        available: Math.max(0, row.on_hand - row.reserved),
        lowStockThreshold: row.low_stock_threshold,
        updatedAt: row.updated_at,
      } satisfies AdminInventoryRow;
    }),
    movements,
    movementError: movementError ? "庫存異動紀錄目前無法讀取。" : null,
    error: null,
  };
}
