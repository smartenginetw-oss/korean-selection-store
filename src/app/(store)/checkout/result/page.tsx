import Link from "next/link";
import styles from "./result.module.css";

export default async function CheckoutResultPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return <div className={`container ${styles.page}`}><div className={styles.icon}>✓</div><div className="eyebrow">Test payment adapter</div><h1 className="serif">測試訂單已建立</h1><p>訂單編號：<strong>{order ?? "DEMO"}</strong></p><div className={styles.notice}>測試付款 adapter 不會實際扣款；訂單已送出，並依 15 分鐘規則建立庫存保留。正式金流與電子發票將在後續階段接入。</div><div className={styles.actions}><Link className="button button-primary" href="/products">繼續逛逛</Link></div></div>;
}
