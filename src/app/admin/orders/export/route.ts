import { getAdminOrders, isFulfillmentFilter, isOrderFilter, isPaymentFilter, isShippingFilter } from "@/features/orders/admin/server";
import { fulfillmentStatusLabels, orderStatusLabels, paymentStatusLabels } from "@/features/orders/order-status-labels";

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(values: Array<string | number>) {
  return values.map(csvCell).join(",");
}

function twd(value: number) {
  return Math.round(value);
}

function taipeiDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const payment = url.searchParams.get("payment") ?? undefined;
  const order = url.searchParams.get("order") ?? undefined;
  const search = url.searchParams.get("q") ?? undefined;
  const shipping = url.searchParams.get("shipping") ?? undefined;
  const { orders, error } = await getAdminOrders(
    isFulfillmentFilter(status) ? status : undefined,
    5000,
    search,
    isPaymentFilter(payment) ? payment : undefined,
    isOrderFilter(order) ? order : undefined,
    1,
    isShippingFilter(shipping) ? shipping : undefined,
  );

  if (error) return new Response(error, { status: 503 });

  const lines = [
    csvRow(["GYEOT 訂單匯出"]),
    csvRow(["資料範圍", search ? `目前搜尋：${search}` : "目前篩選結果"]),
    "",
    csvRow(["訂單編號", "建立時間（台北）", "顧客姓名（遮罩）", "電子郵件（遮罩）", "供貨模式", "付款狀態", "訂單狀態", "履約狀態", "配送方式", "物流商", "追蹤碼", "訂單金額（TWD）"]),
    ...orders.map((item) => csvRow([
      item.orderNumber,
      taipeiDate(item.createdAt),
      item.customerName,
      item.customerEmail,
      item.stockMode === "mixed" ? "混合" : item.stockMode === "preorder" ? "預購" : "現貨",
      paymentStatusLabels[item.paymentStatus] ?? "狀態更新",
      orderStatusLabels[item.orderStatus] ?? "狀態更新",
      fulfillmentStatusLabels[item.fulfillmentStatus] ?? "狀態更新",
      item.shipment?.shippingMethod ?? "home_delivery",
      item.shipment?.carrier ?? "",
      item.shipment?.trackingNumber ?? "",
      twd(item.grandTotal),
    ])),
  ];

  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gyeot-orders-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
