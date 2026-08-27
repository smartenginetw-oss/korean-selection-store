import Link from "next/link";

import { PurchaseAnalytics } from "@/components/purchase-analytics";
import { createClient } from "@/lib/supabase/server";
import styles from "./result.module.css";

export default async function CheckoutResultPage({ searchParams }: { searchParams: Promise<{ order?: string; provider?: string; status?: string; method?: string }> }) {
  const { order, provider, status, method } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const accountHref = user ? "/account" : "/login?next=%2Faccount";
  const accountLabel = user ? "查看會員訂單" : "登入查看訂單";
  const isEcpay = provider === "ecpay";
  const resultState = !isEcpay ? "test" : status === "paid" ? "paid" : status === "failed" ? "failed" : "pending";
  const paymentMethod = method === "atm" || method === "cvs" || method === "credit" ? method : "credit";
  const paymentMethodLabel = paymentMethod === "atm" ? "ATM 虛擬帳號" : paymentMethod === "cvs" ? "超商代碼" : "信用卡";
  const copy = {
    test: {
      icon: "✓",
      eyebrow: "測試付款",
      title: "測試訂單已建立",
      notice: "測試付款 adapter 不會實際扣款；訂單已送出，並依商店設定建立庫存保留。若有優惠碼，折扣已由伺服器驗證後計入訂單。正式金流與電子發票將在後續階段接入。",
      tone: "success",
    },
    paid: {
      icon: "✓",
      eyebrow: "綠界測試付款",
      title: "付款結果已送出",
      notice: `綠界已回傳${paymentMethodLabel}付款結果，伺服器會以回呼再次驗證；請稍後到會員中心查看最終付款與訂單進度。測試環境不會產生正式扣款。`,
      tone: "success",
    },
    failed: {
      icon: "!",
      eyebrow: "綠界測試付款",
      title: "付款未完成",
      notice: `這次${paymentMethodLabel}付款未完成，不會進入出貨流程；若已建立待付款訂單，伺服器回呼會自動處理並釋放庫存。測試環境不會產生正式扣款。`,
      tone: "error",
    },
    pending: {
      icon: "…",
      eyebrow: "綠界測試付款",
      title: "等待付款確認",
      notice: paymentMethod === "atm" || paymentMethod === "cvs"
        ? `${paymentMethodLabel}繳費資訊尚在同步，請稍後到會員中心訂單明細查看。請不要重複送出同一筆訂單；測試環境不會產生正式扣款。`
        : "付款結果尚在傳送，請稍後到會員中心查看。請不要重複送出同一筆訂單；測試環境不會產生正式扣款。",
      tone: "pending",
    },
  } as const;
  const current = copy[resultState];
  return <div className={`container ${styles.page}`}>
    <PurchaseAnalytics orderNumber={order ?? ""} state={resultState} />
    <div className={`${styles.icon} ${styles[`icon${current.tone[0].toUpperCase()}${current.tone.slice(1)}`]}`}>{current.icon}</div>
    <div className="eyebrow">{current.eyebrow}</div>
    <h1 className="serif">{current.title}</h1>
    <p>訂單編號：<strong>{order ?? "DEMO"}</strong></p>
    <div className={`${styles.notice} ${styles[`notice${current.tone[0].toUpperCase()}${current.tone.slice(1)}`]}`}>{current.notice}</div>
    <div className={styles.actions}><Link className="button button-primary" href="/products">繼續逛逛</Link><Link className="button button-secondary" href={accountHref}>{accountLabel}</Link></div>
  </div>;
}
