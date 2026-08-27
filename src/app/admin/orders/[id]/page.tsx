import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderActions } from "@/features/orders/admin/order-actions";
import { RefundOrderForm } from "@/features/orders/admin/refund-order-form";
import { getAdminOrderDetail } from "@/features/orders/admin/server";
import { fulfillmentStatusLabels, formatActorLabel, formatStatusLabel, formatTimelineEventLabel, formatTimelineNote, paymentStatusLabels, shipmentStatusLabels } from "@/features/orders/order-status-labels";
import { formatTwd } from "@/lib/money";
import { shippingMethodLabel, isConvenienceStoreMethod } from "@/lib/shipping";
import styles from "../../admin.module.css";

const fulfillmentLabels: Record<string, string> = { ...fulfillmentStatusLabels };
const paymentLabels: Record<string, string> = { ...paymentStatusLabels };

const paymentMethodLabels: Record<string, string> = {
  test: "測試付款",
  credit: "ECPay 信用卡",
  atm: "ECPay ATM 虛擬帳號",
  cvs: "ECPay 超商代碼",
};

const shipmentLabels: Record<string, string> = { ...shipmentStatusLabels };

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

function paymentInfoRows(payment: { paymentMethod: string; paymentInfo: Record<string, string> }) {
  const rows: Array<[string, string]> = [];
  if (payment.paymentMethod === "atm" && payment.paymentInfo.bankCode) rows.push(["銀行代碼", payment.paymentInfo.bankCode]);
  if (payment.paymentMethod === "atm" && payment.paymentInfo.vAccount) rows.push(["虛擬帳號", payment.paymentInfo.vAccount]);
  if (payment.paymentMethod === "cvs" && payment.paymentInfo.paymentNo) rows.push(["繳費代碼", payment.paymentInfo.paymentNo]);
  if (payment.paymentInfo.expireDate) rows.push(["繳費期限", payment.paymentInfo.expireDate]);
  return rows;
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { order, error } = await getAdminOrderDetail(id);
  if (!order && !error) notFound();

  if (!order) {
    return <div className={styles.notice}>{error ?? "訂單明細目前無法讀取。"}</div>;
  }

  const latestShipment = order.shipments[0] ?? null;
  const refundableAmount = order.payments.reduce((total, payment) => total + Math.max(0, payment.amount - payment.refundedAmount), 0);
  const actionOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.recipientName,
    customerEmail: order.email,
    stockMode: order.stockMode,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    orderStatus: order.orderStatus,
    grandTotal: order.grandTotal,
    createdAt: order.createdAt,
    shipment: latestShipment,
  };

  return <>
    <div className={styles.titleRow}>
      <div>
        <Link className={styles.backLink} href="/admin/orders">← 返回訂單管理</Link>
         <div className="eyebrow">訂單明細・資料庫</div>
        <h1 className="serif">{order.orderNumber}</h1>
        <p className={styles.detailMeta}>建立於 {formatDate(order.createdAt)} · 最後更新 {formatDate(order.updatedAt)}</p>
      </div>
      <div className={styles.statusRow}>
        <span className={`badge ${order.paymentStatus === "paid" ? "badge-stock" : "badge-preorder"}`}>{paymentLabels[order.paymentStatus] ?? "狀態更新"}</span>
        <span className="badge badge-preorder">{fulfillmentLabels[order.fulfillmentStatus] ?? "狀態更新"}</span>
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
          <div className={styles.panelHeading}><h2>訂單進度</h2><span>{order.timeline.length} 筆紀錄</span></div>
          {order.timeline.length ? <ol className={styles.timeline}>{order.timeline.map((event) => <li key={event.id} className={styles.timelineItem}>
            <div className={styles.timelineDot} aria-hidden="true" />
            <div><strong>{formatTimelineEventLabel(event.eventType, event.toStatus)}</strong><small>{formatDate(event.createdAt)} · {formatActorLabel(event.actorType)}</small>
              {(event.fromStatus || event.toStatus) && <p>{event.fromStatus ? formatStatusLabel(event.fromStatus) : "開始"} → {event.toStatus ? formatStatusLabel(event.toStatus) : "—"}</p>}
              {formatTimelineNote(event.note) && <p>{formatTimelineNote(event.note)}</p>}
            </div>
           </li>)}</ol> : <p className={styles.empty}>目前尚無訂單進度紀錄。</p>}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>退款</h2><span>{refundableAmount > 0 ? `可退 ${formatTwd(refundableAmount)}` : "無可退餘額"}</span></div>
          <RefundOrderForm orderId={order.id} refundableAmount={refundableAmount} />
        </section>
      </div>

      <aside className={styles.detailAside}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>金額摘要</h2><span>{order.currency}</span></div>
          <dl className={styles.detailList}>
            <div><dt>商品小計</dt><dd>{formatTwd(order.subtotal)}</dd></div>
            <div><dt>折扣</dt><dd>{order.discountTotal ? `−${formatTwd(order.discountTotal)}` : formatTwd(0)}</dd></div>
            {order.couponCode && <div><dt>優惠碼</dt><dd>{order.couponCode}</dd></div>}
            <div><dt>配送運費</dt><dd>{formatTwd(order.shippingTotal)}</dd></div>
            <div className={styles.totalRow}><dt>訂單總額</dt><dd>{formatTwd(order.grandTotal)}</dd></div>
          </dl>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>顧客與配送</h2><span>{stockModeLabel(order.stockMode)}</span></div>
          <dl className={styles.detailList}>
            <div><dt>收件人</dt><dd>{order.recipientName}</dd></div>
            <div><dt>電子郵件</dt><dd><a href={`mailto:${order.email}`}>{order.email}</a></dd></div>
            <div><dt>手機</dt><dd><a href={`tel:${order.phone}`}>{order.phone}</a></dd></div>
            <div><dt>配送方式</dt><dd>{shippingMethodLabel(order.shippingMethod)}</dd></div>
            {isConvenienceStoreMethod(order.shippingMethod as "cvs_711" | "cvs_family" | "home_delivery") && latestShipment ? <div><dt>取貨門市</dt><dd>{latestShipment.storeName ?? "—"}{latestShipment.storeCode ? `（${latestShipment.storeCode}）` : ""}<br />{latestShipment.storeAddress ?? "—"}</dd></div> : <div><dt>地址</dt><dd>{order.postalCode} {order.city}{order.district}<br />{order.addressLine}</dd></div>}
            {order.customerNote && <div><dt>顧客備註</dt><dd>{order.customerNote}</dd></div>}
          </dl>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>付款</h2><span>{paymentLabels[order.paymentStatus] ?? "狀態更新"}</span></div>
          {order.payments.length ? <div className={styles.compactList}>{order.payments.map((payment) => <div key={payment.id} className={styles.compactItem}><strong>{paymentMethodLabels[payment.paymentMethod] ?? "其他付款方式"}</strong><span>{paymentLabels[payment.status] ?? "狀態更新"} · {formatTwd(payment.amount)}</span>{payment.refundedAmount > 0 && <small>已退款：{formatTwd(payment.refundedAmount)}</small>}{payment.providerPaymentId && <small>交易序號：{payment.providerPaymentId}</small>}{paymentInfoRows(payment).map(([label, value]) => <small key={label}>{label}：{value}</small>)}{payment.failureMessage && <small className={styles.warningText}>{payment.failureMessage}</small>}{payment.paidAt && <small>付款時間：{formatDate(payment.paidAt)}</small>}</div>)}</div> : <p className={styles.empty}>尚無付款紀錄。</p>}
        </section>

      </aside>
    </div>

    <div className={styles.detailOperations}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>出貨資訊</h2><span>{latestShipment ? (shipmentLabels[latestShipment.status] ?? "狀態更新") : "尚未建立"}</span></div>
        {latestShipment ? <dl className={styles.detailList}><div><dt>配送方式</dt><dd>{shippingMethodLabel(latestShipment.shippingMethod)}</dd></div><div><dt>物流商</dt><dd>{latestShipment.carrier ?? "待安排"}</dd></div><div><dt>追蹤碼</dt><dd>{latestShipment.trackingNumber ?? "待填寫"}</dd></div>{isConvenienceStoreMethod(latestShipment.shippingMethod as "cvs_711" | "cvs_family" | "home_delivery") && <div><dt>取貨門市</dt><dd>{latestShipment.storeName ?? "—"}{latestShipment.storeCode ? `（${latestShipment.storeCode}）` : ""}<br />{latestShipment.storeAddress ?? "—"}</dd></div>}{latestShipment.shippedAt && <div><dt>出貨時間</dt><dd>{formatDate(latestShipment.shippedAt)}</dd></div>}{latestShipment.deliveredAt && <div><dt>送達時間</dt><dd>{formatDate(latestShipment.deliveredAt)}</dd></div>}</dl> : <p className={styles.empty}>尚未建立出貨資訊。</p>}
      </section>

      <section className={styles.panel}>
        <h2>更新履約</h2>
        <OrderActions order={actionOrder} />
      </section>
    </div>
  </>;
}
