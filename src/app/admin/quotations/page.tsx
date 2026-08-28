import Link from "next/link";
import { requireProcurement } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { RoundedDatePicker } from "@/components/rounded-date-picker";
import { RoundedSelect } from "@/components/rounded-select";
import adminStyles from "../admin.module.css";
import { createQuotationAction, updateQuotationStatusAction } from "./actions";
import { QuotationLineItems } from "./quotation-line-items";
import styles from "./quotations.module.css";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "草稿",
  received: "已收到",
  approved: "已核准",
  rejected: "已拒絕",
  converted: "已轉採購單",
};

const currencyOptions = ["KRW", "TWD", "USD", "CNY"].map((currency) => ({ value: currency, label: currency }));

function todayInput() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));
const createStatusOptions = statusOptions.filter(({ value }) => value !== "converted");

function statusOptionsFor(status: string) {
  const legalStatuses = status === "draft"
    ? ["draft", "received", "rejected"]
    : status === "received"
      ? ["received", "approved", "rejected"]
      : status === "approved"
        ? ["approved", "converted"]
        : [status];
  return statusOptions.filter(({ value }) => legalStatuses.includes(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium" }).format(new Date(`${value}T00:00:00Z`));
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

export default async function AdminQuotationsPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  await requireProcurement();
  const params = await searchParams;
  const supabase = await createClient();
  const [suppliersResult, productsResult, variantsResult, quotationsResult, itemsResult] = await Promise.all([
    supabase.from("suppliers").select("id,name,country,is_active").order("is_active", { ascending: false }).order("name"),
    supabase.from("products").select("id,name").eq("status", "active").order("name"),
    supabase.from("product_variants").select("id,product_id,sku").eq("status", "active").order("sku"),
    supabase.from("supplier_quotations").select("id,supplier_id,quote_number,quote_date,currency,exchange_rate,status,note,created_at,updated_at").order("quote_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("supplier_quotation_items").select("id,quotation_id,product_name,variant_name,sku,unit_cost,moq,quantity,currency,total_cost").order("created_at"),
  ]);

  const suppliers = suppliersResult.data ?? [];
  const products = productsResult.data ?? [];
  const variants = variantsResult.data ?? [];
  const quotations = quotationsResult.data ?? [];
  const items = itemsResult.data ?? [];
  const supplierNameById = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const hasReadError = suppliersResult.error || productsResult.error || variantsResult.error || quotationsResult.error || itemsResult.error;
  const itemsByQuotation = new Map<string, typeof items>();
  for (const item of items) itemsByQuotation.set(item.quotation_id, [...(itemsByQuotation.get(item.quotation_id) ?? []), item]);

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">採購・營運工具</div><h1 className="serif">廠商報價</h1></div><span className="badge badge-stock">V1.5 採購</span></div>
    {params.status === "created" && <div className={adminStyles.notice}>報價單已建立，之後可轉成採購單。</div>}
    {params.status === "updated" && <div className={adminStyles.notice}>報價單狀態已更新。</div>}
    {params.status === "error" && <div className={styles.error}>{params.message ?? "操作尚未完成，請稍後再試。"}</div>}
    {hasReadError && <div className={styles.error}>部分報價資料目前無法讀取，請重新整理後再試。</div>}
    <div className={styles.layout}>
      <section className={adminStyles.panel}>
        <h2>建立報價單</h2>
        <p className={adminStyles.panelIntro}>先記錄廠商報價與商品明細；核准後可直接帶入採購單，避免重新輸入成本。</p>
        {!suppliers.length && <p className={styles.hint}>請先到「供應商」建立至少一家啟用中的供應商。</p>}
        <form action={createQuotationAction} className={styles.form}>
          <div className={styles.twoColumns}>
            <label>供應商<RoundedSelect name="supplierId" options={[{ value: "", label: "選擇供應商" }, ...suppliers.filter((supplier) => supplier.is_active).map((supplier) => ({ value: supplier.id, label: `${supplier.name} · ${supplier.country}` }))]} defaultValue="" disabled={!suppliers.length} ariaLabel="供應商" /></label>
            <label>報價單號<input className="input" name="quoteNumber" required maxLength={80} placeholder="例如：SEOUL-2026-0827" /></label>
            <label>報價日期<RoundedDatePicker name="quoteDate" label="報價日期" initialValue={todayInput()} required /></label>
            <label>幣別<RoundedSelect name="currency" options={currencyOptions} defaultValue="KRW" ariaLabel="幣別" /></label>
            <label>匯率（對 TWD）<input className="input" name="exchangeRate" type="number" min="0.000001" step="0.000001" defaultValue="1" required /></label>
            <label>狀態<RoundedSelect name="status" options={createStatusOptions} defaultValue="draft" ariaLabel="報價單狀態" /></label>
          </div>
          <QuotationLineItems products={products} variants={variants} />
          <label>報價備註<textarea className="input" name="note" rows={3} maxLength={2000} placeholder="付款、交期或其他條件（選填）" /></label>
          <button className="button button-primary" type="submit" disabled={!suppliers.length}>建立報價單</button>
        </form>
      </section>
      <section className={adminStyles.panel}>
        <h2>狀態流程</h2>
        <ol className={styles.steps}><li><strong>草稿</strong><span>先記錄收到的價格與數量。</span></li><li><strong>已收到／已核准</strong><span>確認條件後，準備轉成採購單。</span></li><li><strong>已轉採購單</strong><span>此狀態保留報價歷史，不再刪除。</span></li></ol>
        <p className={styles.hint}>核准報價後可按「轉成採購單」帶入供應商、幣別、匯率與明細；建立後報價會保留為已轉採購單。</p>
      </section>
    </div>
    <section className={adminStyles.panel}>
      <div className={adminStyles.panelHeading}><h2>報價紀錄</h2><span>{quotations.length} 張</span></div>
      {quotations.length ? <div className={styles.list}>{quotations.map((quotation) => { const quotationItems = itemsByQuotation.get(quotation.id) ?? []; const total = quotationItems.reduce((sum, item) => sum + Number(item.total_cost || 0), 0); return <article className={styles.item} key={quotation.id}>
        <div className={styles.itemHeading}><div><strong>{quotation.quote_number}</strong><small>{supplierNameById.get(quotation.supplier_id) ?? "未知供應商"} · {formatDate(quotation.quote_date)}</small></div><span className={`badge ${quotation.status === "approved" ? "badge-stock" : quotation.status === "rejected" ? "badge-preorder" : "badge-stock"}`}>{statusLabels[quotation.status] ?? quotation.status}</span></div>
        <div className={styles.itemBody}>{quotationItems.map((item) => <div className={styles.line} key={item.id}><span>{item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ""}<small>{item.sku ?? "暫存商品"} · 數量 {item.quantity} · MOQ {item.moq}</small></span><strong>{formatMoney(Number(item.total_cost), item.currency)}</strong></div>)}{!quotationItems.length && <p className={styles.hint}>尚無報價明細。</p>}</div>
        <div className={styles.itemFooter}><span>合計 {formatMoney(total, quotation.currency)} · 匯率 {quotation.exchange_rate}</span><div className={styles.footerActions}>{quotation.status === "approved" && <Link className="button button-secondary button-small" href={`/admin/purchase-orders?quotationId=${quotation.id}`}>轉成採購單</Link>}{statusOptionsFor(quotation.status).length > 1 && <form action={updateQuotationStatusAction} className={styles.statusForm}><input type="hidden" name="id" value={quotation.id} /><label className="srOnly" htmlFor={`status-${quotation.id}`}>更新報價單狀態</label><div className={styles.statusSelect}><RoundedSelect id={`status-${quotation.id}`} name="status" options={statusOptionsFor(quotation.status)} defaultValue={quotation.status} ariaLabel="更新報價單狀態" /></div><button className="button button-secondary button-small" type="submit">更新狀態</button></form>}</div></div>
      </article>; })}</div> : <p className={adminStyles.empty}>目前尚無報價紀錄。</p>}
    </section>
  </>;
}
