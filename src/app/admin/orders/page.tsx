import Link from "next/link";
import { RoundedSelect } from "@/components/rounded-select";
import { OrderActions } from "@/features/orders/admin/order-actions";
import { getAdminOrders, isFulfillmentFilter, isOrderFilter, isPaymentFilter, isShippingFilter } from "@/features/orders/admin/server";
import { shippingOptions } from "@/lib/shipping";
import { fulfillmentStatusLabels, orderStatusLabels, paymentStatusLabels } from "@/features/orders/order-status-labels";
import { formatTwd } from "@/lib/money";
import styles from "../admin.module.css";

const fulfillmentLabels: Record<string, string> = { ...fulfillmentStatusLabels };
const paymentLabels: Record<string, string> = { ...paymentStatusLabels };
const orderLabels: Record<string, string> = { ...orderStatusLabels };
const fulfillmentFilterOptions = [{ value: "", label: "全部履約" }, { value: "unfulfilled", label: "未處理" }, { value: "awaiting_stock", label: "等待到貨" }, { value: "processing", label: "處理中" }, { value: "shipped", label: "已出貨" }, { value: "delivered", label: "已送達" }, { value: "cancelled", label: "已取消" }] as const;
const paymentFilterOptions = [{ value: "", label: "全部付款" }, { value: "pending", label: "待付款" }, { value: "paid", label: "已付款" }, { value: "failed", label: "付款失敗" }, { value: "refunded", label: "已退款" }, { value: "partially_refunded", label: "部分退款" }] as const;
const orderFilterOptions = [{ value: "", label: "全部訂單" }, { value: "pending_payment", label: "等待付款" }, { value: "confirmed", label: "已確認" }, { value: "completed", label: "已完成" }, { value: "cancelled", label: "已取消" }, { value: "expired", label: "已逾時" }, { value: "exception", label: "待人工處理" }] as const;
const shippingFilterOptions = [{ value: "", label: "全部配送" }, ...shippingOptions] as const;
const quickFilterOptions = [{ value: "all", label: "全部訂單", href: "/admin/orders" }, { value: "pending", label: "待付款", href: "/admin/orders?payment=pending" }, { value: "processing", label: "待出貨", href: "/admin/orders?status=processing" }, { value: "shipped", label: "已出貨", href: "/admin/orders?status=shipped" }, { value: "completed", label: "已完成", href: "/admin/orders?order=completed" }] as const;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; payment?: string; order?: string; shipping?: string; q?: string; page?: string }> }) {
  const { status, payment, order, shipping, q, page } = await searchParams;
  const fulfillmentFilter = isFulfillmentFilter(status) ? status : undefined;
  const paymentFilter = isPaymentFilter(payment) ? payment : undefined;
  const orderFilter = isOrderFilter(order) ? order : undefined;
  const shippingFilter = isShippingFilter(shipping) ? shipping : undefined;
  const currentPage = Math.max(1, Math.min(10000, Number.parseInt(page ?? "1", 10) || 1));
  const { orders, total, page: resolvedPage, pageSize, totalPages, error } = await getAdminOrders(fulfillmentFilter, 50, q, paymentFilter, orderFilter, currentPage, shippingFilter);
  const exportQuery = new URLSearchParams();
  if (q) exportQuery.set("q", q);
  if (fulfillmentFilter) exportQuery.set("status", fulfillmentFilter);
  if (paymentFilter) exportQuery.set("payment", paymentFilter);
  if (orderFilter) exportQuery.set("order", orderFilter);
  if (shippingFilter) exportQuery.set("shipping", shippingFilter);
  const queryForPage = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (fulfillmentFilter) params.set("status", fulfillmentFilter);
    if (paymentFilter) params.set("payment", paymentFilter);
    if (orderFilter) params.set("order", orderFilter);
    if (shippingFilter) params.set("shipping", shippingFilter);
    if (targetPage > 1) params.set("page", String(targetPage));
    const queryString = params.toString();
    return queryString ? `/admin/orders?${queryString}` : "/admin/orders";
  };
  const firstRow = total ? (resolvedPage - 1) * pageSize + 1 : 0;
  const lastRow = total ? Math.min(resolvedPage * pageSize, total) : 0;
  const activeQuickFilter = paymentFilter === "pending" && !fulfillmentFilter && !orderFilter && !shippingFilter && !q ? "pending" : fulfillmentFilter === "processing" && !paymentFilter && !orderFilter && !shippingFilter && !q ? "processing" : fulfillmentFilter === "shipped" && !paymentFilter && !orderFilter && !shippingFilter && !q ? "shipped" : orderFilter === "completed" && !paymentFilter && !fulfillmentFilter && !shippingFilter && !q ? "completed" : !paymentFilter && !fulfillmentFilter && !orderFilter && !shippingFilter && !q ? "all" : null;
  return <><div className={styles.titleRow}><div><div className="eyebrow">訂單・資料庫</div><h1 className="serif">訂單管理</h1></div><form className={styles.filters}><label htmlFor="order-search">搜尋訂單</label><input className="input" id="order-search" name="q" defaultValue={q ?? ""} placeholder="訂單編號、電子郵件、姓名" maxLength={80} /><label htmlFor="order-status">履約狀態</label><RoundedSelect id="order-status" name="status" options={fulfillmentFilterOptions} defaultValue={fulfillmentFilter ?? ""} ariaLabel="履約狀態" /><label htmlFor="order-payment">付款狀態</label><RoundedSelect id="order-payment" name="payment" options={paymentFilterOptions} defaultValue={paymentFilter ?? ""} ariaLabel="付款狀態" /><label htmlFor="order-overall">訂單狀態</label><RoundedSelect id="order-overall" name="order" options={orderFilterOptions} defaultValue={orderFilter ?? ""} ariaLabel="訂單狀態" /><label htmlFor="order-shipping">配送方式</label><RoundedSelect id="order-shipping" name="shipping" options={shippingFilterOptions} defaultValue={shippingFilter ?? ""} ariaLabel="配送方式" /><button className="button button-secondary" type="submit">套用</button><Link className="button button-secondary" href={`/admin/orders/export?${exportQuery.toString()}`}>下載 CSV</Link></form></div><nav className={styles.quickFilters} aria-label="訂單快捷檢視">{quickFilterOptions.map((option) => <Link className={`button button-secondary button-small ${activeQuickFilter === option.value ? styles.quickFilterActive : ""}`} href={option.href} aria-current={activeQuickFilter === option.value ? "page" : undefined} key={option.value}>{option.label}</Link>)}</nav>{error && <div className={styles.notice}>{error}</div>}<section className={styles.panel}><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>訂單</th><th>顧客（已遮罩）</th><th>類型</th><th>付款／訂單</th><th>履約／出貨</th><th>金額</th><th>操作</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link><br /><small>{new Date(order.createdAt).toLocaleDateString("zh-TW")}</small></td><td>{order.customerName}<br /><small>{order.customerEmail}</small></td><td>{order.stockMode === "mixed" ? "混合" : order.stockMode === "preorder" ? "預購" : "現貨"}</td><td><span className={`badge ${order.paymentStatus === "paid" ? "badge-stock" : "badge-preorder"}`}>{paymentLabels[order.paymentStatus] ?? "狀態更新"}</span><br /><small>{orderLabels[order.orderStatus] ?? "狀態更新"}</small></td><td>{fulfillmentLabels[order.fulfillmentStatus] ?? "狀態更新"}{order.shipment && <><br /><small>{order.shipment.carrier ?? "物流待安排"}／{order.shipment.trackingNumber ?? "待填寫"}</small></>}</td><td>{formatTwd(order.grandTotal)}</td><td><OrderActions order={order} /></td></tr>)}</tbody></table></div>{!orders.length && !error && <p className={styles.empty}>目前沒有符合條件的訂單。</p>}{!error && total > 0 && <div className={styles.pagination}><span>顯示第 {firstRow}–{lastRow} 筆，共 {total} 筆</span><div className={styles.paginationActions}>{resolvedPage > 1 ? <Link className="button button-secondary button-small" href={queryForPage(resolvedPage - 1)}>上一頁</Link> : <span className={`${styles.paginationDisabled} button button-secondary button-small`}>上一頁</span>}{resolvedPage < totalPages ? <Link className="button button-secondary button-small" href={queryForPage(resolvedPage + 1)}>下一頁</Link> : <span className={`${styles.paginationDisabled} button button-secondary button-small`}>下一頁</span>}</div></div>}</section></>;
}
