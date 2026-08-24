import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderActions } from "@/features/orders/admin/order-actions";
import { getAdminOrderDetail } from "@/features/orders/admin/server";
import { formatTwd } from "@/lib/money";
import styles from "../../admin.module.css";

const fulfillmentLabels: Record<string, string> = {
  unfulfilled: "未處理",
  awaiting_stock: "等待到貨",
  processing: "處理中",
  shipped: "已出貨",
  delivered: "已送達",
  cancelled: "已取消",
};

const paymentLabels: Record<string, string> = {
  pending: "待付款",
  paid: "已付款",
  failed: "付款失敗",
  refunded: "已退款",
  partially_refunded: "部分退款",
};

const eventLabels: Record<string, string> = {
  order_created: "訂單已建立",
  checkout_created: "訂單已建立",
  inventory_reserved: "庫存已保留",
  payment_succeeded: "付款已完成",
  fulfillment_status_changed: "履約狀態更新",
  payment_status_changed: "付款狀態更新",
  shipment_created: "出貨資訊已建立",
  order_cancelled: "訂單已取消",
  order_completed: "訂單已完成",
};

function formatTimelineNote(note: string | null) {
  if (!note) return "";
  if (note === "Test payment adapter confirmed the order.") return "測試付款已確認訂單。";
  const inventoryMatch = note.match(/^Inventory held for (\d+) minutes\.$/);
  if (inventoryMatch) return `庫存已保留 ${inventoryMatch[1]} 分鐘。`;
  return note;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function stockModeLabel(value: string) {
  return value === "mixed" ? "現貨＋預購" : value === "preorder" ? "預購" : "現貨";
}

function optionsLabel(options: Record<string, string>) {
  const values = Object.entries(options).map(([name, value]) => `${name}：${value}`);
  return values.length ? values.join("／") : "未指定規格";
}

function actorLabel(value: string) {
  return value === "admin" ? "老闆" : value === "customer" ? "顧客" : "系統";
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { order, error } = await getAdminOrderDetail(id);
  if (!order && !error) notFound();

  if (!order) {
    return <div className={styles.notice}>{error ?? "訂單明細目前無法讀取。"}</div>;
  }

  const latestShipment = order.shipments[0] ?? null;
  const actionOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.recipientName,
    customerEmail: order.email,
    stockMode: order.stockMode,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    grandTotal: order.grandTotal,
    createdAt: order.createdAt,
    shipment: latestShipment,
  };

  return <>
    <div className={styles.titleRow}>
      <div>
        <Link className={styles.backLink} href="/admin/orders">← 返回訂單管理</Link>
        <div className="eyebrow">Order detail · Supabase</div>
        <h1 className="serif">{order.orderNumber}</h1>
        <p className={styles.detailMeta}>建立於 {formatDate(order.createdAt)} · 最後更新 {formatDate(order.updatedAt)}</p>
      </div>
      <div className={styles.statusRow}>
        <span className={`badge ${order.paymentStatus === "paid" ? "badge-stock" : "badge-preorder"}`}>{paymentLabels[order.paymentStatus] ?? order.paymentStatus}</span>
        <span className="badge badge-preorder">{fulfillmentLabels[order.fulfillmentStatus] ?? order.fulfillmentStatus}</span>
      </div>
    </div>

    <div className={styles.detailGrid}>
      <div className={styles.detailMain}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>商品明細</h2><span>{order.items.length} 項商品</span></div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>商品</th><th>規格／SKU</th><th>單價</th><th>數量</th><th>小計</th></tr></thead>
              <tbody>{order.items.map((item) => <tr key={item.id}>
                <td><strong>{item.productName}</strong><br /><small>{item.fulfillmentMode === "preorder" ? "預購" : "現貨"}{item.preorderAvailableAt ? ` · ${item.preorderAvailableAt} 到貨` : ""}</small></td>
                <td>{optionsLabel(item.selectedOptions)}<br /><small>{item.variantName} · {item.sku}</small></td>
                <td>{formatTwd(item.unitPrice)}</td>
                <td>{item.quantity}</td>
                <td><strong>{formatTwd(item.lineTotal)}</strong></td>
              </tr>)}</tbody>
            </table>
          </div>
          {!order.items.length && <p className={styles.empty}>這筆訂單沒有商品明細。</p>}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>訂單 Timeline</h2><span>{order.timeline.length} 筆紀錄</span></div>
          {order.timeline.length ? <ol className={styles.timeline}>{order.timeline.map((event) => <li key={event.id} className={styles.timelineItem}>
            <div className={styles.timelineDot} aria-hidden="true" />
            <div><strong>{eventLabels[event.eventType] ?? event.eventType}</strong><small>{formatDate(event.createdAt)} · {actorLabel(event.actorType)}</small>
              {(event.fromStatus || event.toStatus) && <p>{event.fromStatus ? (fulfillmentLabels[event.fromStatus] ?? event.fromStatus) : "開始"} → {event.toStatus ? (fulfillmentLabels[event.toStatus] ?? event.toStatus) : "—"}</p>}
              {formatTimelineNote(event.note) && <p>{formatTimelineNote(event.note)}</p>}
            </div>
          </li>)}</ol> : <p className={styles.empty}>目前尚無 Timeline 紀錄。</p>}
        </section>
      </div>

      <aside className={styles.detailAside}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>金額摘要</h2><span>{order.currency}</span></div>
          <dl className={styles.detailList}>
            <div><dt>商品小計</dt><dd>{formatTwd(order.subtotal)}</dd></div>
            <div><dt>折扣</dt><dd>{order.discountTotal ? `−${formatTwd(order.discountTotal)}` : formatTwd(0)}</dd></div>
            {order.couponCode && <div><dt>優惠碼</dt><dd>{order.couponCode}</dd></div>}
            <div><dt>宅配運費</dt><dd>{formatTwd(order.shippingTotal)}</dd></div>
            <div className={styles.totalRow}><dt>訂單總額</dt><dd>{formatTwd(order.grandTotal)}</dd></div>
          </dl>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>顧客與配送</h2><span>{stockModeLabel(order.stockMode)}</span></div>
          <dl className={styles.detailList}>
            <div><dt>收件人</dt><dd>{order.recipientName}</dd></div>
            <div><dt>Email</dt><dd><a href={`mailto:${order.email}`}>{order.email}</a></dd></div>
            <div><dt>手機</dt><dd><a href={`tel:${order.phone}`}>{order.phone}</a></dd></div>
            <div><dt>配送方式</dt><dd>{order.shippingMethod === "home_delivery" ? "宅配（台灣）" : order.shippingMethod}</dd></div>
            <div><dt>地址</dt><dd>{order.postalCode} {order.city}{order.district}<br />{order.addressLine}</dd></div>
            {order.customerNote && <div><dt>顧客備註</dt><dd>{order.customerNote}</dd></div>}
          </dl>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>付款</h2><span>{paymentLabels[order.paymentStatus] ?? order.paymentStatus}</span></div>
          {order.payments.length ? <div className={styles.compactList}>{order.payments.map((payment) => <div key={payment.id} className={styles.compactItem}><strong>{payment.provider}</strong><span>{payment.status} · {formatTwd(payment.amount)}</span>{payment.providerPaymentId && <small>交易序號：{payment.providerPaymentId}</small>}{payment.failureMessage && <small className={styles.warningText}>{payment.failureMessage}</small>}{payment.paidAt && <small>付款時間：{formatDate(payment.paidAt)}</small>}</div>)}</div> : <p className={styles.empty}>尚無付款紀錄。</p>}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>出貨資訊</h2><span>{latestShipment?.status ?? "尚未建立"}</span></div>
          {latestShipment ? <dl className={styles.detailList}><div><dt>物流商</dt><dd>{latestShipment.carrier}</dd></div><div><dt>追蹤碼</dt><dd>{latestShipment.trackingNumber}</dd></div>{latestShipment.shippedAt && <div><dt>出貨時間</dt><dd>{formatDate(latestShipment.shippedAt)}</dd></div>}{latestShipment.deliveredAt && <div><dt>送達時間</dt><dd>{formatDate(latestShipment.deliveredAt)}</dd></div>}</dl> : <p className={styles.empty}>尚未建立出貨資訊。</p>}
        </section>

        <section className={styles.panel}>
          <h2>更新履約</h2>
          <OrderActions order={actionOrder} />
        </section>
      </aside>
    </div>
  </>;
}
