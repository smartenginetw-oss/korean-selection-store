import Link from "next/link";

import { getAdminInventory } from "@/features/inventory/admin/server";
import { formatInventoryMovementReason, formatInventoryMovementType } from "@/features/inventory/labels";
import styles from "../admin.module.css";
import { InventoryTable } from "./inventory-table";
import { InventoryMovementFilters } from "./movement-filters";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminInventoryPage({ searchParams }: { searchParams?: Promise<{ start?: string | string[]; end?: string | string[]; q?: string | string[] }> }) {
  const params = searchParams ? await searchParams : {};
  const start = first(params.start) ?? "";
  const end = first(params.end) ?? "";
  const q = first(params.q) ?? "";
  const hasFilters = Boolean(start || end || q);
  const { rows, movements, movementError, error } = await getAdminInventory(hasFilters ? 5000 : 100, { start, end, q });
  const lowStockCount = rows.filter((row) => row.available <= row.lowStockThreshold).length;
  const exportQuery = new URLSearchParams();
  if (start) exportQuery.set("start", start);
  if (end) exportQuery.set("end", end);
  if (q) exportQuery.set("q", q);
  const exportHref = exportQuery.toString() ? `/admin/inventory/export?${exportQuery.toString()}` : "/admin/inventory/export";

  return <>
    <div className={styles.titleRow}>
      <div><div className="eyebrow">庫存・資料庫</div><h1 className="serif">庫存管理</h1></div>
      <div className={styles.inventorySummary}><span>品項 {rows.length}</span><span className={lowStockCount ? styles.warningText : ""}>低庫存 {lowStockCount}</span></div>
    </div>
    {error && <div className={styles.notice}>{error}</div>}
    <section className={styles.panel}><p className={styles.panelIntro}>調整會檢查已保留庫存，並留下庫存異動與老闆稽核紀錄。</p><InventoryTable rows={rows} /></section>
    <section id="inventory-movements" className={`${styles.panel} ${styles.inventoryHistoryPanel}`}>
      <div className={styles.sectionHeading}>
        <div><h2>最近庫存異動</h2><p className={styles.panelIntro}>保留／釋放事件會顯示在訂單進度；此處記錄實際入庫、扣庫、回庫與手動調整。</p></div>
        <div className={styles.sectionActions}><span className={styles.sectionMeta}>{hasFilters ? `符合 ${movements.length} 筆` : `最近 ${movements.length} 筆`}</span><Link className="button button-secondary button-small" href={exportHref}>下載 CSV</Link></div>
      </div>
      <InventoryMovementFilters start={start} end={end} q={q} />
      {movementError && <div className={styles.notice}>{movementError}</div>}
      {movements.length ? <div className={styles.inventoryTableWrap}><table className={styles.table + " " + styles.inventoryMovementTable}><thead><tr><th>時間</th><th>商品／SKU</th><th>異動</th><th>數量</th><th>結餘</th><th>來源</th><th>原因</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{new Date(movement.createdAt).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}</td><td><strong>{movement.productName}</strong><br /><small>{movement.sku}</small></td><td>{formatInventoryMovementType(movement.type)}</td><td><span className={movement.quantityDelta > 0 ? "badge badge-stock" : "badge badge-preorder"}>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</span></td><td>{movement.balanceAfter}</td><td>{movement.orderLabel}</td><td>{formatInventoryMovementReason(movement.reason)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>{hasFilters ? "目前沒有符合條件的庫存異動。" : "目前尚無庫存異動紀錄。"}</p>}
    </section>
  </>;
}
