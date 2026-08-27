import Link from "next/link";
import { requireProcurement } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import adminStyles from "../admin.module.css";
import { createPurchaseOrderAction, updatePurchaseOrderStatusAction } from "./actions";
import styles from "./purchase-orders.module.css";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "草稿",
  ordered: "已下單",
  partial_received: "部分到貨",
  received: "已收貨",
  cancelled: "已取消",
};
const currencies = ["KRW", "TWD", "USD", "CNY"];

function todayInput() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium" }).format(new Date(`${value}T00:00:00Z`));
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

export default async function AdminPurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  await requireProcurement();
  const params = await searchParams;
  const supabase = await createClient();
  const [suppliersResult, productsResult, variantsResult, quotationsResult, ordersResult, itemsResult] = await Promise.all([
    supabase.from("suppliers").select("id,name,country,is_active").order("is_active", { ascending: false }).order("name"),
    supabase.from("products").select("id,name").eq("status", "active").order("name"),
    supabase.from("product_variants").select("id,product_id,sku").eq("status", "active").order("sku"),
    supabase.from("supplier_quotations").select("id,supplier_id,quote_number,status,currency").in("status", ["draft", "received", "approved"]).order("quote_number"),
    supabase.from("purchase_orders").select("id,po_number,supplier_id,quotation_id,currency,exchange_rate,ordered_date,expected_date,status,subtotal,shipping_cost,other_cost,total_cost,note,created_at").order("ordered_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("purchase_order_items").select("id,purchase_order_id,product_name,variant_name,sku,unit_cost,quantity,currency,total_cost").order("created_at"),
  ]);

  const suppliers = suppliersResult.data ?? [];
  const products = productsResult.data ?? [];
  const variants = variantsResult.data ?? [];
  const quotations = quotationsResult.data ?? [];
  const orders = ordersResult.data ?? [];
  const items = itemsResult.data ?? [];
  const supplierNameById = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  const hasReadError = suppliersResult.error || productsResult.error || variantsResult.error || quotationsResult.error || ordersResult.error || itemsResult.error;
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) itemsByOrder.set(item.purchase_order_id, [...(itemsByOrder.get(item.purchase_order_id) ?? []), item]);
  const quotationLabelById = new Map(quotations.map((quotation) => [quotation.id, `${quotation.quote_number} · ${supplierNameById.get(quotation.supplier_id) ?? "供應商"}`]));

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">採購・營運工具</div><h1 className="serif">採購單</h1></div><span className="badge badge-stock">V1.5 採購</span></div>
    {params.status === "created" && <div className={adminStyles.notice}>採購單已建立；若有帶入報價單，該報價單已標記為已轉採購單。</div>}
    {params.status === "updated" && <div className={adminStyles.notice}>採購單狀態已更新。</div>}
    {params.status === "error" && <div className={styles.error}>{params.message ?? "操作尚未完成，請稍後再試。"}</div>}
    {hasReadError && <div className={styles.error}>部分採購資料目前無法讀取，請重新整理後再試。</div>}
    <div className={styles.layout}>
      <section className={adminStyles.panel}>
        <h2>建立採購單</h2>
        <p className={adminStyles.panelIntro}>可從已核准的廠商報價建立採購單，成本與商品規格會保留當下快照。</p>
        {!suppliers.filter((supplier) => supplier.is_active).length && <p className={styles.hint}>請先到「供應商」建立至少一家啟用中的供應商。</p>}
        <form action={createPurchaseOrderAction} className={styles.form}>
          <div className={styles.twoColumns}>
            <label>供應商<select className="input" name="supplierId" required defaultValue=""><option value="" disabled>選擇供應商</option>{suppliers.filter((supplier) => supplier.is_active).map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name} · {supplier.country}</option>)}</select></label>
            <label>採購單號<input className="input" name="poNumber" required maxLength={80} placeholder="例如：PO-2026-0827-01" /></label>
            <label>下單日期<input className="input" name="orderedDate" type="date" required defaultValue={todayInput()} /></label>
            <label>預計到貨日<input className="input" name="expectedDate" type="date" /></label>
            <label>幣別<select className="input" name="currency" defaultValue="KRW">{currencies.map((currency) => <option value={currency} key={currency}>{currency}</option>)}</select></label>
            <label>匯率（對 TWD）<input className="input" name="exchangeRate" type="number" min="0.000001" step="0.000001" defaultValue="1" required /></label>
            <label>帶入報價單（選填）<select className="input" name="quotationId" defaultValue=""><option value="">不帶入報價單</option>{quotations.map((quotation) => <option value={quotation.id} key={quotation.id}>{quotationLabelById.get(quotation.id)} · {statusLabels[quotation.status] ?? quotation.status}</option>)}</select></label>
            <label>建立後狀態<select className="input" name="status" defaultValue="draft"><option value="draft">草稿</option><option value="ordered">已下單</option></select></label>
          </div>
          <div className={styles.twoColumns}>
            <label>商品（選填）<select className="input" name="productId" defaultValue=""><option value="">暫存商品／下方自行填寫</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
            <label>規格（選填）<select className="input" name="variantId" defaultValue=""><option value="">不指定規格</option>{variants.map((variant) => <option value={variant.id} key={variant.id}>{productNameById.get(variant.product_id) ?? "商品"} · {variant.sku}</option>)}</select></label>
            <label>暫存商品名稱（選填）<input className="input" name="tempProductName" maxLength={160} placeholder="未建檔商品才需要填寫" /></label>
            <label>規格備註（選填）<input className="input" name="variantName" maxLength={160} placeholder="例如：黑色／M" /></label>
            <label>單件成本<input className="input" name="unitCost" type="number" min="0.01" step="0.01" required placeholder="例如：18500" /></label>
            <label>採購數量<input className="input" name="quantity" type="number" min="1" step="1" defaultValue="1" required /></label>
            <label>運費<input className="input" name="shippingCost" type="number" min="0" step="0.01" defaultValue="0" required /></label>
            <label>其他費用<input className="input" name="otherCost" type="number" min="0" step="0.01" defaultValue="0" required /></label>
          </div>
          <label>採購備註<textarea className="input" name="note" rows={3} maxLength={2000} placeholder="付款、交期或其他條件（選填）" /></label>
          <button className="button button-primary" type="submit" disabled={!suppliers.filter((supplier) => supplier.is_active).length}>建立採購單</button>
        </form>
      </section>
      <section className={adminStyles.panel}>
        <h2>採購狀態流程</h2>
        <ol className={styles.steps}><li><strong>草稿</strong><span>確認供應商、成本、數量與交期。</span></li><li><strong>已下單</strong><span>已向供應商發出採購需求。</span></li><li><strong>部分到貨／已收貨</strong><span>V1.5 先記錄狀態；實際入庫與分批驗收將在到貨模組接入。</span></li><li><strong>已取消</strong><span>保留採購歷史，不直接刪除。</span></li></ol>
        <p className={styles.hint}>一張採購單目前先建立一筆明細；後續可擴充多商品與分批到貨。</p>
      </section>
    </div>
    <section className={adminStyles.panel}>
      <div className={adminStyles.panelHeading}><h2>採購紀錄</h2><span>{orders.length} 張</span></div>
      {orders.length ? <div className={styles.list}>{orders.map((order) => { const orderItems = itemsByOrder.get(order.id) ?? []; return <article className={styles.item} key={order.id}>
        <div className={styles.itemHeading}><div><strong>{order.po_number}</strong><small>{supplierNameById.get(order.supplier_id) ?? "未知供應商"} · 下單 {formatDate(order.ordered_date)}{order.expected_date ? ` · 預計 ${formatDate(order.expected_date)}` : ""}</small></div><span className="badge badge-stock">{statusLabels[order.status] ?? order.status}</span></div>
        <div className={styles.itemBody}>{orderItems.map((item) => <div className={styles.line} key={item.id}><span>{item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ""}<small>{item.sku ?? "暫存商品"} · 數量 {item.quantity} · 單件 {formatMoney(Number(item.unit_cost), item.currency)}</small></span><strong>{formatMoney(Number(item.total_cost), item.currency)}</strong></div>)}{!orderItems.length && <p className={styles.hint}>尚無採購明細。</p>}</div>
        <div className={styles.costs}><span>商品成本 <strong>{formatMoney(Number(order.subtotal), order.currency)}</strong></span><span>運費 <strong>{formatMoney(Number(order.shipping_cost), order.currency)}</strong></span><span>其他 <strong>{formatMoney(Number(order.other_cost), order.currency)}</strong></span><span>合計 <strong>{formatMoney(Number(order.total_cost), order.currency)}</strong></span></div>
        <div className={styles.itemFooter}><span>{order.quotation_id ? `來源報價：${quotationLabelById.get(order.quotation_id) ?? "已封存報價"}` : "未連結報價單"} · 匯率 {order.exchange_rate}</span><div className={styles.actions}>{order.status !== "cancelled" && order.status !== "received" && <Link className="button button-secondary button-small" href={`/admin/purchase-orders/${order.id}/receive`}>登記到貨</Link>}<form action={updatePurchaseOrderStatusAction} className={styles.statusForm}><input type="hidden" name="id" value={order.id} /><label className="srOnly" htmlFor={`po-status-${order.id}`}>更新採購單狀態</label><select className="input" id={`po-status-${order.id}`} name="status" defaultValue={order.status}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="button button-secondary button-small" type="submit">更新狀態</button></form></div></div>
      </article>; })}</div> : <p className={adminStyles.empty}>目前尚無採購紀錄。</p>}
    </section>
  </>;
}
