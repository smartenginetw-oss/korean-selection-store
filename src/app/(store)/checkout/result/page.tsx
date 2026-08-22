import Link from "next/link";
import styles from "./result.module.css";

export default async function CheckoutResultPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return <div className={`container ${styles.page}`}><div className={styles.icon}>✓</div><div className="eyebrow">Demo order created</div><h1 className="serif">測試訂單已建立</h1><p>訂單編號：<strong>{order ?? "DEMO"}</strong></p><div className={styles.notice}>這是前端 Preview 訂單，沒有扣款、寫入資料庫或占用正式庫存。</div><div className={styles.actions}><Link className="button button-primary" href="/products">繼續逛逛</Link><Link className="button button-secondary" href="/admin/orders">查看 Admin Demo</Link></div></div>;
}
