import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import styles from "./result.module.css";

export default async function CheckoutResultPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const accountHref = user ? "/account" : "/login?next=%2Faccount";
  const accountLabel = user ? "查看會員訂單" : "登入查看訂單";
  return <div className={`container ${styles.page}`}><div className={styles.icon}>✓</div><div className="eyebrow">Test payment adapter</div><h1 className="serif">測試訂單已建立</h1><p>訂單編號：<strong>{order ?? "DEMO"}</strong></p><div className={styles.notice}>測試付款 adapter 不會實際扣款；訂單已送出，並依商店設定建立庫存保留。若有優惠碼，折扣已由伺服器驗證後計入訂單。正式金流與電子發票將在後續階段接入。</div><div className={styles.actions}><Link className="button button-primary" href="/products">繼續逛逛</Link><Link className="button button-secondary" href={accountHref}>{accountLabel}</Link></div></div>;
}
