import { getAdminInventory } from "@/features/inventory/admin/server";
import { formatInventoryMovementReason, formatInventoryMovementType } from "@/features/inventory/labels";

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(values: Array<string | number>) {
  return values.map(csvCell).join(",");
}

function taipeiDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { movements, movementError, error } = await getAdminInventory(5000, {
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });
  if (error || movementError) return new Response(error ?? movementError ?? "庫存異動目前無法匯出。", { status: 503 });

  const lines = [
    csvRow(["GYEOT 庫存異動匯出"]),
    csvRow(["資料範圍", `${url.searchParams.get("start") || "不限開始日期"} 至 ${url.searchParams.get("end") || "不限結束日期"}`]),
    "",
    csvRow(["時間（台北）", "商品", "SKU", "異動類型", "數量變化", "異動後庫存", "來源", "原因"]),
    ...movements.map((movement) => csvRow([
      taipeiDate(movement.createdAt),
      movement.productName,
      movement.sku,
      formatInventoryMovementType(movement.type),
      movement.quantityDelta,
      movement.balanceAfter,
      movement.orderLabel,
      formatInventoryMovementReason(movement.reason),
    ])),
  ];
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gyeot-inventory-movements-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
