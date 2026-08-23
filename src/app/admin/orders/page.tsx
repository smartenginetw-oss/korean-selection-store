import Link from "next/link";
import { OrderActions } from "@/features/orders/admin/order-actions";
import { getAdminOrders, isFulfillmentFilter } from "@/features/orders/admin/server";
import { formatTwd } from "@/lib/money";
import styles from "../admin.module.css";

const fulfillmentLabels: Record<string, string> = {
  unfulfilled: "未處理",
  awaiting_stock: "等待到貨",
  processing: "處理中",
  shipped: "已出貨",
  delivered: "已送達",
  cancelled: "已取消",
};

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = isFulfillmentFilter(status) ? status : undefined;
  const { orders, error } = await getAdminOrders(filter);
  return <><div className={styles.titleRow}><div><div className="eyebrow">Orders · Supabase</div><h1 className="serif">訂單管理</h1></div><form className={styles.filters}><label htmlFor="order-status">履約狀態</label><select className="input" id="order-status" name="status" defaultValue={filter ?? ""}><option value="">全部</option><option value="unfulfilled">未處理</option><option value="awaiting_stock">等待到貨</option><option value="processing">處理中</option><option value="shipped">已出貨</option><option value="delivered">已送達</option><option value="cancelled">已取消</option></select><button className="button button-secondary" type="submit">套用</button></form></div>{error && <div className={styles.notice}>{error}</div>}<section className={styles.panel}><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>訂單</th><th>顧客（已遮罩）</th><th>類型</th><th>付款</th><th>履約／出貨</th><th>金額</th><th>操作</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link><br /><small>{new Date(order.createdAt).toLocaleDateString("zh-TW")}</small></td><td>{order.customerName}<br /><small>{order.customerEmail}</small></td><td>{order.stockMode === "mixed" ? "混合" : order.stockMode === "preorder" ? "預購" : "現貨"}</td><td><span className={`badge ${order.paymentStatus === "paid" ? "badge-stock" : "badge-preorder"}`}>{order.paymentStatus === "paid" ? "已付款" : order.paymentStatus}</span></td><td>{fulfillmentLabels[order.fulfillmentStatus] ?? order.fulfillmentStatus}{order.shipment && <><br /><small>{order.shipment.carrier}／{order.shipment.trackingNumber}</small></>}</td><td>{formatTwd(order.grandTotal)}</td><td><OrderActions order={order} /></td></tr>)}</tbody></table></div>{!orders.length && !error && <p className={styles.empty}>目前沒有符合條件的訂單。</p>}</section></>;
}
