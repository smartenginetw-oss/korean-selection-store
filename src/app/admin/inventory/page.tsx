import { getAdminInventory } from "@/features/inventory/admin/server";
import styles from "../admin.module.css";
import { InventoryTable } from "./inventory-table";

export default async function AdminInventoryPage() {
  const { rows, error } = await getAdminInventory();
  const lowStockCount = rows.filter((row) => row.available <= row.lowStockThreshold).length;
  return <><div className={styles.titleRow}><div><div className="eyebrow">Inventory · Supabase</div><h1 className="serif">庫存管理</h1></div><div className={styles.inventorySummary}><span>品項 {rows.length}</span><span className={lowStockCount ? styles.warningText : ""}>低庫存 {lowStockCount}</span></div></div>{error && <div className={styles.notice}>{error}</div>}<section className={styles.panel}><p className={styles.panelIntro}>調整會檢查已保留庫存，並留下庫存異動與老闆稽核紀錄。</p><InventoryTable rows={rows} /></section></>;
}
