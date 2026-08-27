const movementTypeLabels: Record<string, string> = {
  purchase_received: "進貨入庫",
  sale_committed: "出貨扣庫",
  cancellation_return: "取消回庫",
  refund_return: "退款回庫",
  manual_adjustment: "手動調整",
  damage: "損耗扣庫",
};

const fixedReasons: Record<string, string> = {
  "Stock received.": "進貨入庫。",
  "Order shipped by admin.": "後台出貨扣庫。",
  "Order cancellation returned stock.": "訂單取消，庫存回庫。",
  "Refund returned stock.": "退款完成，庫存回庫。",
  "Damaged stock.": "商品損耗扣庫。",
};

export function formatInventoryMovementType(type: string) {
  return movementTypeLabels[type] ?? "其他庫存異動";
}

export function formatInventoryMovementReason(reason: string | null) {
  if (!reason) return "未填寫原因";
  return fixedReasons[reason] ?? reason;
}
