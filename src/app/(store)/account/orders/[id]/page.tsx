import Link from "next/link";
import { redirect } from "next/navigation";

import { getCatalog } from "@/features/catalog/server";
import { ReorderButton } from "@/features/cart/reorder-button";
import { RetryPaymentButton } from "@/features/checkout/retry-payment-button";
import { OrderStatusRefresh } from "@/features/orders/order-status-refresh";
import { fulfillmentStatusLabels, formatTimelineEventLabel, formatTimelineNote, shipmentStatusLabels } from "@/features/orders/order-status-labels";
import { createClient } from "@/lib/supabase/server";
import { shippingMethodLabel, isConvenienceStoreMethod } from "@/lib/shipping";
import styles from "./order-detail.module.css";

export const dynamic = "force-dynamic";

function formatTwd(value: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-TW", { dateStyle: "medium", timeStyle: "short" });
}

function optionText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}：${String(item)}`).join("／");
}

type PaymentInfo = {
  paymentType?: string;
  paymentNo?: string;
  bankCode?: string;
  vAccount?: string;
  expireDate?: string;
  tradeNo?: string;
};

function parsePaymentInfo(value: unknown): PaymentInfo | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const result: PaymentInfo = {};
  for (const key of ["paymentType", "paymentNo", "bankCode", "vAccount", "expireDate", "tradeNo"] as const) {
    if (typeof record[key] === "string" && record[key].trim()) result[key] = record[key].trim();
  }
  return Object.keys(result).length ? result : null;
}

const paymentMethodLabels: Record<string, string> = {
  test: "測試付款",
  credit: "信用卡",
  atm: "ATM 虛擬帳號",
  cvs: "超商代碼",
};

export default async function MemberOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/account/orders/${id}`)}`);

  const orderResult = await supabase.from("orders").select("id, order_number, created_at, recipient_name, phone, postal_code, city, district, address_line, subtotal, discount_total, shipping_method, shipping_total, grand_total, currency, payment_status, fulfillment_status, order_status, stock_mode, customer_note").eq("id", id).maybeSingle();
  if (orderResult.error || !orderResult.data) redirect("/account");
  const order = orderResult.data;
  const [itemsResult, shipmentResult, timelineResult, paymentResult] = await Promise.all([
    supabase.from("order_items").select("product_id, variant_id, product_name, variant_name, sku, unit_price, quantity, line_total, fulfillment_mode, selected_options").eq("order_id", id).order("created_at", { ascending: true }),
    supabase.from("shipments").select("carrier, tracking_number, shipping_method, store_code, store_name, store_address, status, shipped_at, delivered_at").eq("order_id", id).maybeSingle(),
    supabase.from("order_timeline").select("event_type, to_status, note, created_at").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("payments").select("provider, status, payment_method, payment_info").eq("order_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const items = itemsResult.data ?? [];
  const shipment = shipmentResult.data;
  const timeline = timelineResult.data ?? [];
  const failedPayment = paymentResult.data;
  const paymentInfo = parsePaymentInfo(failedPayment?.payment_info);
  const paymentMethod = failedPayment?.payment_method ?? (failedPayment?.provider === "ecpay" ? "credit" : "test");
  const canRetryPayment = order.payment_status === "failed" && order.order_status === "cancelled" && failedPayment?.provider === "ecpay" && failedPayment.status === "failed";
  const catalog = items.length ? await getCatalog() : [];
  const catalogById = new Map(catalog.map((product) => [product.id, product]));
  const reorderItems = items.map((item) => {
    const product = item.product_id ? catalogById.get(item.product_id) : undefined;
    const variant = product && item.variant_id ? product.variants?.find((entry) => entry.id === item.variant_id) : undefined;
    if (!product || !variant || variant.availability === "unavailable") return null;
    const selectedOptions = item.selected_options && typeof item.selected_options === "object" && !Array.isArray(item.selected_options)
      ? Object.fromEntries(Object.entries(item.selected_options).filter(([, value]) => typeof value === "string")) as Record<string, string>
      : {};
    const optionValues = Object.values(selectedOptions);
    return {
      variantKey: variant.id,
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      color: selectedOptions["顏色"] ?? selectedOptions.Color ?? optionValues[0] ?? "",
      size: selectedOptions["尺寸"] ?? selectedOptions.Size ?? optionValues[1] ?? "",
      quantity: Math.min(item.quantity, 10),
      price: variant.price,
      availability: variant.availability,
      arrival: variant.arrival,
      palette: product.palette,
      image: product.images?.[0],
      selectedOptions,
    };
  });

  return <div className={`container ${styles.page}`}>
    <Link className={styles.back} href="/account">← 返回會員中心</Link>
    <div className={styles.heading}><div><div className="eyebrow">訂單明細 · GYEOT</div><h1 className="serif">{order.order_number}</h1></div><p>{formatDate(order.created_at)}<br />{fulfillmentStatusLabels[order.fulfillment_status] ?? "狀態更新"}</p></div>
    <div className={styles.layout}>
      <section className={`${styles.panel} ${styles.itemsPanel}`} aria-labelledby="items-heading"><h2 id="items-heading">商品明細</h2><div className={styles.items}>{items.map((item, index) => { const reorderItem = reorderItems[index]; return <div className={styles.item} key={`${item.sku}-${item.product_name}`}><div><h3>{item.product_name}</h3><p>{item.variant_name} · {item.sku} · 數量 {item.quantity}{optionText(item.selected_options) ? ` · ${optionText(item.selected_options)}` : ""}</p></div><div className={styles.itemAside}><strong>{formatTwd(item.line_total)}</strong>{reorderItem ? <ReorderButton item={reorderItem} /> : <span className={styles.unavailable}>商品或規格已下架</span>}</div></div>; })}</div>{!items.length && <p className={styles.empty}>商品明細目前無法讀取。</p>}<p className={styles.reorderHint}>再次購買會以目前商品價格與可售狀態加入購物車，結帳時仍會重新驗證庫存。</p></section>
      <section className={styles.panel} aria-labelledby="summary-heading"><h2 id="summary-heading">訂單摘要</h2><OrderStatusRefresh orderId={order.id} initialPaymentStatus={order.payment_status} initialFulfillmentStatus={order.fulfillment_status} initialOrderStatus={order.order_status} /><div className={styles.summary}><div className={styles.summaryRow}><span>商品小計</span><strong>{formatTwd(order.subtotal)}</strong></div><div className={styles.summaryRow}><span>運費</span><strong>{formatTwd(order.shipping_total)}</strong></div><div className={styles.summaryRow}><span>付款方式</span><strong>{paymentMethodLabels[paymentMethod] ?? "其他付款方式"}</strong></div><div className={styles.summaryRow}><span>訂單總額</span><strong>{formatTwd(order.grand_total)}</strong></div></div>{paymentInfo && <div className={styles.paymentInfo} aria-label="繳費資訊"><strong>{paymentMethod === "atm" ? "ATM 繳費資訊" : paymentMethod === "cvs" ? "超商繳費資訊" : "付款資訊"}</strong>{paymentMethod === "atm" && paymentInfo.bankCode && <div><span>銀行代碼</span><b>{paymentInfo.bankCode}</b></div>}{paymentMethod === "atm" && paymentInfo.vAccount && <div><span>虛擬帳號</span><b>{paymentInfo.vAccount}</b></div>}{paymentMethod === "cvs" && paymentInfo.paymentNo && <div><span>繳費代碼</span><b>{paymentInfo.paymentNo}</b></div>}{paymentInfo.expireDate && <div><span>繳費期限</span><b>{paymentInfo.expireDate}</b></div>}</div>}{canRetryPayment && <RetryPaymentButton orderId={order.id} orderNumber={order.order_number} />}</section>
      <section className={styles.panel} aria-labelledby="delivery-heading"><h2 id="delivery-heading">配送資訊</h2><div className={styles.summary}><div className={styles.summaryRow}><span>配送方式</span><strong>{shippingMethodLabel(order.shipping_method)}</strong></div><div className={styles.summaryRow}><span>收件人</span><strong>{order.recipient_name} · {order.phone}</strong></div>{isConvenienceStoreMethod(order.shipping_method as "cvs_711" | "cvs_family" | "home_delivery") ? <div className={styles.summaryRow}><span>取貨門市</span><strong>{shipment?.store_name ?? "門市資料待同步"}{shipment?.store_code ? `（${shipment.store_code}）` : ""}<br />{shipment?.store_address ?? ""}</strong></div> : <div className={styles.summaryRow}><span>宅配地址</span><strong>{order.postal_code} {order.city}{order.district}{order.address_line}</strong></div>}{shipment && <><div className={styles.summaryRow}><span>出貨狀態</span><strong>{shipmentStatusLabels[shipment.status] ?? "狀態更新"}</strong></div><div className={styles.summaryRow}><span>出貨資訊</span><strong>{shipment.carrier ?? "物流待安排"} · {shipment.tracking_number || "待填寫"}</strong></div></>}</div></section>
      <section className={styles.panel} aria-labelledby="timeline-heading"><h2 id="timeline-heading">訂單進度</h2>{timeline.length ? <div className={styles.timeline}>{timeline.map((event, index) => <div className={styles.event} key={`${event.created_at}-${index}`}><span className={styles.dot} aria-hidden="true" /><div><strong>{formatTimelineEventLabel(event.event_type, event.to_status)}</strong><span>{formatDate(event.created_at)}{formatTimelineNote(event.note) ? ` · ${formatTimelineNote(event.note)}` : ""}</span></div></div>)}</div> : <p className={styles.empty}>尚未有可顯示的進度更新。</p>}</section>
    </div>
  </div>;
}
