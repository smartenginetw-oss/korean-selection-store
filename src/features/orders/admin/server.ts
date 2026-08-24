import { createClient } from "@/lib/supabase/server";
import { requireOrders } from "@/lib/supabase/auth";

const fulfillmentFilters = ["unfulfilled", "awaiting_stock", "processing", "shipped", "delivered", "cancelled"] as const;
export type FulfillmentFilter = (typeof fulfillmentFilters)[number];

export type AdminOrderSummary = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  stockMode: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  grandTotal: number;
  createdAt: string;
  shipment: AdminShipmentSummary | null;
};

export type AdminShipmentSummary = {
  id: string;
  carrier: string;
  trackingNumber: string;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
};

export type AdminOrderItemDetail = {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  selectedOptions: Record<string, string>;
  unitPrice: number;
  unitCost: number | null;
  quantity: number;
  lineTotal: number;
  fulfillmentMode: string;
  preorderAvailableAt: string | null;
  imagePath: string | null;
};

export type AdminOrderTimelineEntry = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorType: string;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  profileId: string | null;
  email: string;
  phone: string;
  recipientName: string;
  shippingMethod: string;
  postalCode: string;
  city: string;
  district: string;
  addressLine: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  couponCode: string | null;
  shippingTotal: number;
  grandTotal: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  orderStatus: string;
  stockMode: string;
  customerNote: string | null;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItemDetail[];
  payments: Array<{
    id: string;
    provider: string;
    amount: number;
    status: string;
    providerPaymentId: string | null;
    failureMessage: string | null;
    paidAt: string | null;
    createdAt: string;
  }>;
  shipments: AdminShipmentSummary[];
  timeline: AdminOrderTimelineEntry[];
};

function maskName(name: string) {
  const first = Array.from(name.trim())[0] ?? "顧客";
  return `${first}＊＊`;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@", 2);
  if (!local || !domain) return "＊＊＊";
  return `${Array.from(local).slice(0, 2).join("")}***@${domain}`;
}

function mapOrder(row: {
  id: string;
  order_number: string;
  recipient_name: string;
  email: string;
  stock_mode: string;
  payment_status: string;
  fulfillment_status: string;
  grand_total: number;
  created_at: string;
}, shipment: AdminShipmentSummary | null = null): AdminOrderSummary {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: maskName(row.recipient_name),
    customerEmail: maskEmail(row.email),
    stockMode: row.stock_mode,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    grandTotal: row.grand_total,
    createdAt: row.created_at,
    shipment,
  };
}

async function getLatestShipments(supabase: Awaited<ReturnType<typeof createClient>>, orderIds: string[]) {
  if (!orderIds.length) return new Map<string, AdminShipmentSummary>();
  const { data, error } = await supabase
    .from("shipments")
    .select("id,order_id,carrier,tracking_number,status,shipped_at,delivered_at,created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const byOrder = new Map<string, AdminShipmentSummary>();
  for (const row of data ?? []) {
    if (byOrder.has(row.order_id)) continue;
    byOrder.set(row.order_id, {
      id: row.id,
      carrier: row.carrier,
      trackingNumber: row.tracking_number,
      status: row.status,
      shippedAt: row.shipped_at,
      deliveredAt: row.delivered_at,
    });
  }
  return byOrder;
}

export function isFulfillmentFilter(value: string | undefined): value is FulfillmentFilter {
  return Boolean(value && fulfillmentFilters.includes(value as FulfillmentFilter));
}

export async function getAdminOrders(filter?: FulfillmentFilter, limit = 100) {
  await requireOrders();
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id,order_number,recipient_name,email,stock_mode,payment_status,fulfillment_status,grand_total,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter) query = query.eq("fulfillment_status", filter);
  const { data, error } = await query;
  if (error) {
    console.error("[admin/orders] read failed", error.message);
    return { orders: [] as AdminOrderSummary[], error: "訂單資料目前無法讀取。" };
  }

  try {
    const shipments = await getLatestShipments(supabase, (data ?? []).map((row) => row.id));
    return { orders: (data ?? []).map((row) => mapOrder(row, shipments.get(row.id) ?? null)), error: null };
  } catch (shipmentError) {
    console.error("[admin/orders] shipment read failed", shipmentError instanceof Error ? shipmentError.message : shipmentError);
    return { orders: [], error: "訂單出貨資料目前無法讀取。" };
  }
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string")) as Record<string, string>;
}

export async function getAdminOrderDetail(orderId: string) {
  await requireOrders();
  const supabase = await createClient();
  const orderResult = await supabase
    .from("orders")
    .select("id,order_number,profile_id,email,phone,recipient_name,postal_code,city,district,address_line,currency,subtotal,discount_total,coupon_code,shipping_method,shipping_total,grand_total,payment_status,fulfillment_status,order_status,stock_mode,customer_note,placed_at,created_at,updated_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderResult.error) {
    console.error("[admin/order-detail] order read failed", orderResult.error.message);
    return { order: null as AdminOrderDetail | null, error: "訂單資料目前無法讀取。" };
  }
  if (!orderResult.data) return { order: null as AdminOrderDetail | null, error: null };

  const [itemsResult, paymentsResult, shipmentsResult, timelineResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("id,product_name,variant_name,sku,selected_options,unit_price,unit_cost,quantity,line_total,fulfillment_mode,preorder_available_at,image_path")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("id,provider,amount,status,provider_payment_id,failure_message,paid_at,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("shipments")
      .select("id,carrier,tracking_number,status,shipped_at,delivered_at,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_timeline")
      .select("id,event_type,from_status,to_status,actor_type,note,metadata,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
  ]);

  const failed = [itemsResult, paymentsResult, shipmentsResult, timelineResult].find((result) => result.error);
  if (failed?.error) {
    console.error("[admin/order-detail] related data read failed", failed.error.message);
    return { order: null as AdminOrderDetail | null, error: "訂單明細目前無法讀取。" };
  }

  const row = orderResult.data;
  const order: AdminOrderDetail = {
    id: row.id,
    orderNumber: row.order_number,
    profileId: row.profile_id,
    email: row.email,
    phone: row.phone,
    recipientName: row.recipient_name,
    shippingMethod: row.shipping_method,
    postalCode: row.postal_code,
    city: row.city,
    district: row.district,
    addressLine: row.address_line,
    currency: row.currency,
    subtotal: row.subtotal,
    discountTotal: row.discount_total,
    couponCode: row.coupon_code,
    shippingTotal: row.shipping_total,
    grandTotal: row.grand_total,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    orderStatus: row.order_status,
    stockMode: row.stock_mode,
    customerNote: row.customer_note,
    placedAt: row.placed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (itemsResult.data ?? []).map((item) => ({
      id: item.id,
      productName: item.product_name,
      variantName: item.variant_name,
      sku: item.sku,
      selectedOptions: asStringRecord(item.selected_options),
      unitPrice: item.unit_price,
      unitCost: item.unit_cost,
      quantity: item.quantity,
      lineTotal: item.line_total,
      fulfillmentMode: item.fulfillment_mode,
      preorderAvailableAt: item.preorder_available_at,
      imagePath: item.image_path,
    })),
    payments: (paymentsResult.data ?? []).map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      amount: payment.amount,
      status: payment.status,
      providerPaymentId: payment.provider_payment_id,
      failureMessage: payment.failure_message,
      paidAt: payment.paid_at,
      createdAt: payment.created_at,
    })),
    shipments: (shipmentsResult.data ?? []).map((shipment) => ({
      id: shipment.id,
      carrier: shipment.carrier,
      trackingNumber: shipment.tracking_number,
      status: shipment.status,
      shippedAt: shipment.shipped_at,
      deliveredAt: shipment.delivered_at,
    })),
    timeline: (timelineResult.data ?? []).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      actorType: event.actor_type,
      note: event.note,
      metadata: event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata) ? event.metadata as Record<string, unknown> : {},
      createdAt: event.created_at,
    })),
  };

  return { order, error: null };
}

function taipeiDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export async function getAdminDashboardData() {
  await requireOrders();
  const supabase = await createClient();
  const [ordersResult, inventoryResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id,order_number,recipient_name,email,stock_mode,payment_status,fulfillment_status,grand_total,created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("inventory_levels").select("variant_id,on_hand,reserved,low_stock_threshold").order("on_hand", { ascending: true }).limit(20),
  ]);

  if (ordersResult.error || inventoryResult.error) {
    console.error("[admin/dashboard] read failed", ordersResult.error?.message ?? inventoryResult.error?.message);
    return { orders: [] as AdminOrderSummary[], lowStock: [], metrics: null, error: "Dashboard 資料目前無法讀取。" };
  }

  const rawOrders = ordersResult.data ?? [];
  const today = taipeiDateKey(new Date());
  const todayOrders = rawOrders.filter((order) => taipeiDateKey(new Date(order.created_at)) === today);
  const paidToday = todayOrders.filter((order) => order.payment_status === "paid");
  const revenueToday = paidToday.reduce((total, order) => total + order.grand_total, 0);
  const pendingShipping = rawOrders.filter((order) => !["shipped", "delivered", "cancelled"].includes(order.fulfillment_status)).length;

  const inventoryRows = inventoryResult.data ?? [];
  const variantIds = inventoryRows.map((row) => row.variant_id);
  const variantsResult = variantIds.length ? await supabase.from("product_variants").select("id,sku,product_id").in("id", variantIds) : { data: [], error: null };
  const productIds = (variantsResult.data ?? []).map((row) => row.product_id);
  const productsResult = productIds.length ? await supabase.from("products").select("id,name").in("id", productIds) : { data: [], error: null };
  const variantsById = new Map((variantsResult.data ?? []).map((row) => [row.id, row]));
  const productsById = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
  const lowStock = inventoryRows.filter((row) => row.on_hand - row.reserved <= row.low_stock_threshold).slice(0, 5).map((row) => {
    const variant = variantsById.get(row.variant_id);
    const product = variant ? productsById.get(variant.product_id) : undefined;
    return { label: `${product?.name ?? "未命名商品"}／${variant?.sku ?? row.variant_id.slice(0, 8)}`, available: row.on_hand - row.reserved };
  });

  return {
    orders: rawOrders.slice(0, 5).map((row) => mapOrder(row)),
    lowStock,
    metrics: {
      revenueToday,
      orderCountToday: todayOrders.length,
      pendingShipping,
      averageOrderValue: paidToday.length ? Math.round(revenueToday / paidToday.length) : 0,
    },
    error: null,
  };
}
