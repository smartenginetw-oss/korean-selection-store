import { notFound } from "next/navigation";
import styles from "../admin.module.css";

const labels: Record<string, string> = { inventory: "庫存管理", customers: "顧客", coupons: "優惠碼", content: "首頁內容", reports: "基礎報表", settings: "商店設定" };

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params; const label = labels[section]; if (!label) notFound();
  return <><div className={styles.titleRow}><div><div className="eyebrow">Admin foundation</div><h1 className="serif">{label}</h1></div></div><section className={styles.panel}><h2>此模組已建立路由骨架</h2><p className="muted">會在第一條端到端交易流程穩定後，依 Roadmap 補上正式資料與操作。</p></section></>;
}
