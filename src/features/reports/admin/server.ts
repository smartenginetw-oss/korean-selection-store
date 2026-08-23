import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth";

export type AdminReportData = {
  periodLabel: string;
  metrics: {
    orderCount: number;
    paidOrderCount: number;
    revenue: number;
    averageOrderValue: number;
  };
  stockModes: Array<{ label: string; count: number }>;
  fulfillment: Array<{ label: string; count: number }>;
  daily: Array<{ label: string; date: string; orders: number; revenue: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
};

const fulfillmentLabels: Record<string, string> = {
  unfulfilled: "待處理",
  awaiting_stock: "等待到貨",
  processing: "處理中",
  shipped: "已出貨",
  delivered: "已送達",
  cancelled: "已取消",
};

function dateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric" }).format(value);
}

export async function getAdminReports(): Promise<{ report: AdminReportData | null; error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  const ordersResult = await supabase
    .from("orders")
    .select("id,grand_total,payment_status,fulfillment_status,order_status,stock_mode,created_at")
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: true })
    .limit(5000);

  if (ordersResult.error) {
    console.error("[admin/reports] order read failed", ordersResult.error.message);
    return { report: null, error: "報表資料目前無法讀取。" };
  }

  const orders = ordersResult.data ?? [];
  const activeOrders = orders.filter((order) => order.order_status !== "cancelled");
  const paidOrders = activeOrders.filter((order) => order.payment_status === "paid");
  const revenue = paidOrders.reduce((sum, order) => sum + order.grand_total, 0);
  const orderIds = paidOrders.map((order) => order.id);
  const itemResult = orderIds.length
    ? await supabase.from("order_items").select("order_id,product_name,quantity,line_total").in("order_id", orderIds)
    : { data: [], error: null };

  if (itemResult.error) {
    console.error("[admin/reports] item read failed", itemResult.error.message);
    return { report: null, error: "商品銷售報表目前無法讀取。" };
  }

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    return { date: dateKey(date), label: shortDate(date), orders: 0, revenue: 0 };
  });
  const dailyByDate = new Map(days.map((day) => [day.date, day]));
  for (const order of paidOrders) {
    const day = dailyByDate.get(dateKey(order.created_at));
    if (day) {
      day.orders += 1;
      day.revenue += order.grand_total;
    }
  }

  const stockModeCounts = new Map<string, number>([["in_stock", 0], ["preorder", 0], ["mixed", 0]]);
  for (const order of activeOrders) stockModeCounts.set(order.stock_mode, (stockModeCounts.get(order.stock_mode) ?? 0) + 1);
  const stockModes = [
    ["in_stock", "現貨訂單"],
    ["preorder", "預購訂單"],
    ["mixed", "混合訂單"],
  ].map(([key, label]) => ({ label, count: stockModeCounts.get(key) ?? 0 }));

  const fulfillmentCounts = new Map<string, number>();
  for (const order of activeOrders) fulfillmentCounts.set(order.fulfillment_status, (fulfillmentCounts.get(order.fulfillment_status) ?? 0) + 1);
  const fulfillment = Array.from(fulfillmentCounts.entries())
    .sort(([, left], [, right]) => right - left)
    .map(([status, count]) => ({ label: fulfillmentLabels[status] ?? status, count }));

  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of itemResult.data ?? []) {
    const current = productMap.get(item.product_name) ?? { name: item.product_name, quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += item.line_total;
    productMap.set(item.product_name, current);
  }

  return {
    report: {
      periodLabel: `${shortDate(start)} — ${shortDate(new Date())}`,
      metrics: { orderCount: activeOrders.length, paidOrderCount: paidOrders.length, revenue, averageOrderValue: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0 },
      stockModes,
      fulfillment,
      daily: days,
      topProducts: Array.from(productMap.values()).sort((left, right) => right.revenue - left.revenue).slice(0, 5),
    },
    error: null,
  };
}
