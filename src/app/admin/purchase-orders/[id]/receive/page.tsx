import Link from "next/link";
import { notFound } from "next/navigation";

import { RoundedDatePicker } from "@/components/rounded-date-picker";
import { requireProcurement } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import adminStyles from "../../../admin.module.css";
import { recordPurchaseReceiptAction } from "../../actions";
import styles from "./receive.module.css";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "草稿",
  ordered: "已下單",
  partial_received: "部分到貨",
  received: "已收貨",
  cancelled: "已取消",
};

function todayInput() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function PurchaseOrderReceivePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; message?: string }> }) {
  await requireProcurement();
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase.from("purchase_orders").select("id,po_number,supplier_id,ordered_date,expected_date,status,currency").eq("id", id).maybeSingle();
  if (orderError || !order) notFound();
  const [supplierResult, itemsResult, receiptsResult] = await Promise.all([
    supabase.from("suppliers").select("name,country").eq("id", order.supplier_id).maybeSingle(),
    supabase.from("purchase_order_items").select("id,product_name,variant_name,sku,variant_id,quantity,unit_cost,currency").eq("purchase_order_id", order.id).order("created_at"),
    supabase.from("purchase_order_receipts").select("id,receipt_number,received_date,note,created_at").eq("purchase_order_id", order.id).order("received_date", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const supplier = supplierResult.data;
  const items = itemsResult.data ?? [];
  const receiptItemsResult = items.length
    ? await supabase.from("purchase_order_receipt_items").select("receipt_id,purchase_order_item_id,product_name,sku,quantity_received,damaged_quantity").in("purchase_order_item_id", items.map((item) => item.id))
    : { data: [], error: null };
  const receiptItems = receiptItemsResult.data ?? [];
  const receipts = receiptsResult.data ?? [];
  const receivedByItem = new Map<string, number>();
  const damagedByItem = new Map<string, number>();
  const receiptItemsByReceipt = new Map<string, typeof receiptItems>();
  for (const item of receiptItems) {
    receivedByItem.set(item.purchase_order_item_id, (receivedByItem.get(item.purchase_order_item_id) ?? 0) + Number(item.quantity_received || 0));
    damagedByItem.set(item.purchase_order_item_id, (damagedByItem.get(item.purchase_order_item_id) ?? 0) + Number(item.damaged_quantity || 0));
    receiptItemsByReceipt.set(item.receipt_id, [...(receiptItemsByReceipt.get(item.receipt_id) ?? []), item]);
  }
  const receivableItems = items.filter((item) => item.variant_id && Number(item.quantity) - (receivedByItem.get(item.id) ?? 0) - (damagedByItem.get(item.id) ?? 0) > 0);
  const hasReadError = supplierResult.error || itemsResult.error || receiptItemsResult.error || receiptsResult.error;

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">採購・到貨管理</div><h1 className="serif">登記到貨</h1></div><Link className="button button-secondary" href="/admin/purchase-orders">返回採購單</Link></div>
    {query.status === "updated" && <div className={adminStyles.notice}>到貨已登記，庫存與採購單狀態已同步更新。</div>}
    {query.status === "error" && <div className={styles.error}>{query.message ?? "到貨驗收尚未完成，請稍後再試。"}</div>}
    {hasReadError && <div className={styles.error}>部分到貨資料目前無法讀取，請重新整理後再試。</div>}
    <section className={adminStyles.panel}>
      <div className={styles.orderHeading}><div><h2>{order.po_number}</h2><p>{supplier?.name ?? "未知供應商"}{supplier?.country ? ` · ${supplier.country}` : ""} · 下單 {formatDate(order.ordered_date)}{order.expected_date ? ` · 預計 ${formatDate(order.expected_date)}` : ""}</p></div><span className="badge badge-stock">{statusLabels[order.status] ?? order.status}</span></div>
      {order.status === "draft" && <div className={styles.warning}>這張採購單仍是草稿，請先回到採購單列表更新為「已下單」，再登記到貨。</div>}
      {order.status === "cancelled" && <div className={styles.warning}>已取消的採購單不能登記到貨。</div>}
      {order.status === "received" && <div className={adminStyles.notice}>這張採購單的可入庫明細已全部收貨；下方保留歷史紀錄供查閱。</div>}
      <form action={recordPurchaseReceiptAction} className={styles.form}>
        <input type="hidden" name="purchaseOrderId" value={order.id} />
        <div className={styles.twoColumns}><label>到貨單號<input className="input" name="receiptNumber" required maxLength={80} placeholder="例如：GRN-2026-0827-01" /></label><label>到貨日期<RoundedDatePicker name="receivedDate" label="到貨日期" initialValue={todayInput()} required /></label></div>
        <div className={styles.itemList}><div className={styles.itemListHeading}><h3>到貨明細</h3><span>良品入庫；損耗／瑕疵只記錄、不進庫存</span></div>{items.length ? items.map((item) => { const received = receivedByItem.get(item.id) ?? 0; const damaged = damagedByItem.get(item.id) ?? 0; const accounted = received + damaged; const remaining = Math.max(0, Number(item.quantity) - accounted); const disabled = !item.variant_id || remaining <= 0 || order.status === "draft" || order.status === "cancelled" || order.status === "received"; return <div className={styles.itemRow} key={item.id}><div><strong>{item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ""}</strong><small>{item.sku ?? "暫存商品"} · 良品 {received} · 損耗 {damaged} ／ 採購 {item.quantity}{!item.variant_id ? " · 暫存商品無法自動入庫" : ""}</small></div><div className={styles.itemInputs}><label><span>本次良品到貨</span><input className="input" name={`quantity_${item.id}`} type="number" min="0" max={remaining} step="1" defaultValue="0" disabled={disabled} /></label><label><span>本次損耗／瑕疵</span><input className="input" name={`damaged_${item.id}`} type="number" min="0" max={remaining} step="1" defaultValue="0" disabled={disabled} /></label></div></div>; }) : <p className={adminStyles.empty}>這張採購單沒有明細。</p>}</div>
        <label>到貨備註（選填）<textarea className="input" name="note" rows={3} maxLength={2000} placeholder="外箱、瑕疵或驗收備註" /></label>
        <p className={styles.formHint}>良品數量會增加可售庫存；損耗／瑕疵數量只會留在到貨紀錄，不會增加庫存。</p><button className="button button-primary" type="submit" disabled={!receivableItems.length || order.status === "draft" || order.status === "cancelled" || order.status === "received"}>確認到貨並入庫</button>
      </form>
    </section>
    <section className={adminStyles.panel}><div className={adminStyles.panelHeading}><h2>到貨紀錄</h2><span>{receipts.length} 筆</span></div>{receipts.length ? <div className={styles.receiptList}>{receipts.map((receipt) => { const receiptLines = receiptItemsByReceipt.get(receipt.id) ?? []; return <article className={styles.receipt} key={receipt.id}><div className={styles.receiptHeading}><div><strong>{receipt.receipt_number}</strong><small>{formatDate(receipt.received_date)}</small></div><span>{receiptLines.reduce((sum, item) => sum + Number(item.quantity_received || 0), 0)} 件良品 · {receiptLines.reduce((sum, item) => sum + Number(item.damaged_quantity || 0), 0)} 件損耗</span></div>{receiptLines.length > 0 && <div className={styles.receiptLines}>{receiptLines.map((item) => <div className={styles.receiptLine} key={`${receipt.id}-${item.purchase_order_item_id}`}><span>{item.product_name}<small>{item.sku ?? "暫存商品"}</small></span><span>良品 {item.quantity_received} · 損耗 {item.damaged_quantity}</span></div>)}</div>}{receipt.note && <p>{receipt.note}</p>}</article>; })}</div> : <p className={adminStyles.empty}>尚無到貨紀錄。</p>}</section>
  </>;
}
