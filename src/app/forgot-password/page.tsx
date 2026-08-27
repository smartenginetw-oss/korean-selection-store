import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth-forgot-password-form";
import styles from "@/app/auth-page.module.css";

export const metadata = { title: "重設密碼" };

function safeNextPath(value: string | undefined, fallback: string) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ audience?: string; next?: string }> }) {
  const { audience, next } = await searchParams;
  const isAdmin = audience === "admin";
  const nextPath = safeNextPath(next, isAdmin ? "/admin" : "/");
  const loginPath = isAdmin ? `/admin-login?next=${encodeURIComponent(nextPath)}` : `/login?next=${encodeURIComponent(nextPath)}`;

  return <main className={styles.page}><section className={styles.card} aria-labelledby="forgot-password-title">
    <div className={styles.eyebrow}>{isAdmin ? "GYEOT Owner" : "Member access"}</div>
    <h1 id="forgot-password-title" className="serif">忘記密碼</h1>
    <p className={styles.intro}>輸入註冊用 Email；如果帳號存在，我們會寄出重設密碼連結。</p>
    <ForgotPasswordForm audience={isAdmin ? "admin" : "member"} nextPath={nextPath} />
    <div className={styles.links}><Link href={loginPath}>← 返回登入</Link><Link href="/">回到商城</Link></div>
  </section></main>;
}
