import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth";

export type AdminReportData = {
  startDate: string;
  endDate: string;
  granularity: ReportGranularity;
  periodLabel: string;
  metrics: {
    orderCount: number;
    paidOrderCount: number;
    revenue: number;
    averageOrderValue: number;
  };
  stockModes: Array<{ label: string; count: number }>;
  fulfillment: Array<{ label: string; count: number }>;
  trend: Array<{ label: string; date: string; orders: number; revenue: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
};

export type ReportGranularity = "day" | "month" | "year";

export type AdminReportFilters = {
  start?: string;
  end?: string;
  granularity?: string;
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

function isDateInput(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

function inputDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return inputDateKey(date);
}

function bucketKey(value: string, granularity: ReportGranularity) {
  const day = dateKey(value);
  if (granularity === "month") return day.slice(0, 7);
  if (granularity === "year") return day.slice(0, 4);
  return day;
}

function bucketLabel(value: string, granularity: ReportGranularity) {
  if (granularity === "year") return value;
  if (granularity === "month") return value.replace("-", "／");
  return shortDate(new Date(`${value}T00:00:00Z`));
}

function buildBuckets(startDate: string, endDate: string, granularity: ReportGranularity) {
  const buckets: Array<{ date: string; label: string; orders: number; revenue: number }> = [];
  if (granularity === "year") {
    const startYear = Number(startDate.slice(0, 4));
    const endYear = Number(endDate.slice(0, 4));
    for (let year = startYear; year <= endYear; year += 1) {
      const date = String(year);
      buckets.push({ date, label: bucketLabel(date, granularity), orders: 0, revenue: 0 });
    }
    return buckets;
  }

  if (granularity === "month") {
    const start = new Date(`${startDate.slice(0, 7)}-01T00:00:00Z`);
    const end = new Date(`${endDate.slice(0, 7)}-01T00:00:00Z`);
    while (start <= end) {
      const date = start.toISOString().slice(0, 7);
      buckets.push({ date, label: bucketLabel(date, granularity), orders: 0, revenue: 0 });
      start.setUTCMonth(start.getUTCMonth() + 1);
    }
    return buckets;
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (start <= end) {
    const date = inputDateKey(start);
    buckets.push({ date, label: bucketLabel(date, granularity), orders: 0, revenue: 0 });
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return buckets;
}

export async function getAdminReports(filters: AdminReportFilters = {}): Promise<{ report: AdminReportData | null; error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const defaultStart = addDays(today, -29);
  const startDate = isDateInput(filters.start) ? filters.start : defaultStart;
  const endDate = isDateInput(filters.end) ? filters.end : today;
  let safeStartDate = startDate <= endDate ? startDate : endDate;
  const safeEndDate = startDate <= endDate ? endDate : startDate;
  const maxRangeDays = 3660;
  const selectedRangeDays = Math.floor((Date.parse(`${safeEndDate}T00:00:00Z`) - Date.parse(`${safeStartDate}T00:00:00Z`)) / 86400000) + 1;
  if (selectedRangeDays > maxRangeDays) safeStartDate = addDays(safeEndDate, -(maxRangeDays - 1));
  const granularity: ReportGranularity = filters.granularity === "month" || filters.granularity === "year" ? filters.granularity : "day";
  const endExclusive = addDays(safeEndDate, 1);

  const ordersResult = await supabase
    .from("orders")
    .select("id,grand_total,payment_status,fulfillment_status,order_status,stock_mode,created_at")
    .gte("created_at", `${safeStartDate}T00:00:00+08:00`)
    .lt("created_at", `${endExclusive}T00:00:00+08:00`)
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

  const trend = buildBuckets(safeStartDate, safeEndDate, granularity);
  const trendByDate = new Map(trend.map((day) => [day.date, day]));
  for (const order of paidOrders) {
    const day = trendByDate.get(bucketKey(order.created_at, granularity));
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
      startDate: safeStartDate,
      endDate: safeEndDate,
      granularity,
      periodLabel: `${safeStartDate} — ${safeEndDate}`,
      metrics: { orderCount: activeOrders.length, paidOrderCount: paidOrders.length, revenue, averageOrderValue: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0 },
      stockModes,
      fulfillment,
      trend,
      topProducts: Array.from(productMap.values()).sort((left, right) => right.revenue - left.revenue).slice(0, 5),
    },
    error: null,
  };
}
