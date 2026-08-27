import { getAdminReports, type AdminReportData } from "@/features/reports/admin/server";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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

function buildCsv(report: AdminReportData) {
  const lines: string[] = [];
  lines.push(csvRow(["GYEOT 報表匯出"]));
  lines.push(csvRow(["統計期間", report.periodLabel]));
  lines.push(csvRow(["統計期間粒度", report.granularity === "day" ? "每日" : report.granularity === "month" ? "每月" : "每年"]));
  lines.push("");
  lines.push(csvRow(["營運摘要"]));
  lines.push(csvRow(["指標", "數值"]));
  lines.push(csvRow(["有效訂單", report.metrics.orderCount]));
  lines.push(csvRow(["已付款訂單", report.metrics.paidOrderCount]));
  lines.push(csvRow(["收入（TWD）", twd(report.metrics.revenue)]));
  lines.push(csvRow(["商品成本＋營業費用（TWD）", twd(report.metrics.expense)]));
  lines.push(csvRow(["營業費用（TWD）", twd(report.metrics.operatingExpense)]));
  lines.push(csvRow(["淨收支（TWD）", twd(report.metrics.netCashflow)]));
  lines.push(csvRow(["平均客單價（TWD）", twd(report.metrics.averageOrderValue)]));
  lines.push(csvRow(["商品成本覆蓋率", `${report.metrics.costCoverage}%`]));
  lines.push("");
  lines.push(csvRow(["收支趨勢"]));
  lines.push(csvRow(["期間", "訂單數", "收入（TWD）", "商品成本＋營業費用（TWD）", "營業費用（TWD）", "淨收支（TWD）"]));
  for (const bucket of report.trend) {
    lines.push(csvRow([bucket.label, bucket.orders, twd(bucket.revenue), twd(bucket.expense), twd(bucket.operatingExpense), twd(bucket.netCashflow)]));
  }
  lines.push("");
  lines.push(csvRow(["熱賣商品"]));
  lines.push(csvRow(["商品", "數量", "商品收入（TWD）"]));
  for (const product of report.topProducts) lines.push(csvRow([product.name, product.quantity, twd(product.revenue)]));
  lines.push("");
  lines.push(csvRow(["月份營業費用"]));
  lines.push(csvRow(["月份", "租金（TWD）", "運費（TWD）", "廣告（TWD）", "包材（TWD）", "其他（TWD）", "合計（TWD）", "備註"]));
  for (const expense of report.operatingExpenses) {
    lines.push(csvRow([expense.month, twd(expense.rentCost), twd(expense.shippingCost), twd(expense.advertisingCost), twd(expense.packagingCost), twd(expense.otherCost), twd(expense.total), expense.notes]));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { report, error } = await getAdminReports({
    start: first(url.searchParams.getAll("start")),
    end: first(url.searchParams.getAll("end")),
    granularity: first(url.searchParams.getAll("granularity")),
    cashflow: first(url.searchParams.getAll("cashflow")),
  });

  if (!report) return new Response(error ?? "報表資料目前無法讀取。", { status: 503 });

  return new Response(buildCsv(report), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gyeot-report-${report.startDate}-${report.endDate}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
