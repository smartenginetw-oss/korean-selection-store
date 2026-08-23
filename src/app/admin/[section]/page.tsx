import { notFound } from "next/navigation";
import styles from "../admin.module.css";

const labels: Record<string, string> = { inventory: "庫存管理", customers: "顧客", coupons: "優惠碼", content: "首頁內容", reports: "基礎報表", settings: "商店設定" };

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params; const label = labels[section]; if (!label) notFound();
  return <><div className={styles.titleRow}><div><div className="eyebrow">Owner roadmap</div><h1 className="serif">{label}</h1></div></div><section className={styles.panel}><h2>此模組尚未開放</h2><p className="muted">目前 V1 先聚焦商品、庫存與訂單履約；此頁不會讀取或寫入營運資料。</p></section></>;
}
