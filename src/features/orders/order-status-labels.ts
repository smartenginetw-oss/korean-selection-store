export const paymentStatusLabels: Record<string, string> = {
  pending: "待付款",
  paid: "已付款",
  failed: "付款失敗",
  refunded: "已退款",
  partially_refunded: "部分退款",
};

export const orderStatusLabels: Record<string, string> = {
  pending_payment: "等待付款",
  confirmed: "已確認",
  completed: "已完成",
  cancelled: "已取消",
  expired: "已逾時",
  exception: "待人工處理",
};

export const fulfillmentStatusLabels: Record<string, string> = {
  unfulfilled: "待處理",
  awaiting_stock: "等待到貨",
  processing: "處理中",
  shipped: "已出貨",
  delivered: "已送達",
  cancelled: "已取消",
};

export const shipmentStatusLabels: Record<string, string> = {
  pending: "待出貨",
  ready: "可交寄",
  preparing: "準備出貨",
  shipped: "已出貨",
  in_transit: "配送中",
  delivered: "已送達",
  returned: "已退回",
  cancelled: "已取消",
};

const statusLabels: Record<string, string> = {
  ...paymentStatusLabels,
  ...orderStatusLabels,
  ...fulfillmentStatusLabels,
  ...shipmentStatusLabels,
};

export const timelineEventLabels: Record<string, string> = {
  order_created: "訂單已建立",
  checkout_created: "訂單已建立",
  payment_pending: "等待付款",
  payment_succeeded: "付款已完成",
  payment_succeeded_inventory_exception: "付款已完成，庫存待人工確認",
  payment_failed: "付款失敗",
  payment_status_changed: "付款狀態更新",
  payment_info_received: "付款資訊已更新",
  payment_refunded: "付款已退款",
  inventory_reserved: "庫存已保留",
  inventory_released: "庫存已釋放",
  sale_committed: "庫存已結算",
  fulfillment_updated: "履約狀態更新",
  fulfillment_status_changed: "履約狀態更新",
  shipment_created: "出貨資訊已建立",
  order_cancelled: "訂單已取消",
  order_completed: "訂單已完成",
};

const fixedSystemNotes: Record<string, string> = {
  "Test payment adapter confirmed the order.": "測試付款已確認訂單。",
  "Order shipped by admin.": "後台已更新出貨資訊。",
  "Inventory reservation expired.": "庫存保留已逾時。",
};

export function formatStatusLabel(value: string | null | undefined) {
  if (!value) return "—";
  return statusLabels[value] ?? "狀態更新";
}

export function formatTimelineEventLabel(eventType: string, toStatus?: string | null) {
  return timelineEventLabels[eventType] ?? formatStatusLabel(toStatus);
}

export function formatTimelineNote(note: string | null | undefined) {
  if (!note) return "";
  if (fixedSystemNotes[note]) return fixedSystemNotes[note];
  const inventoryMatch = note.match(/^Inventory held for (\d+) minutes\.$/);
  if (inventoryMatch) return `庫存已保留 ${inventoryMatch[1]} 分鐘。`;
  return note;
}

export function formatActorLabel(value: string) {
  if (value === "admin" || value === "owner") return "老闆／員工";
  if (value === "staff") return "員工";
  if (value === "customer") return "顧客";
  return "系統";
}
