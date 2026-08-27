import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth-reset-password-form";
import styles from "@/app/auth-page.module.css";

export const metadata = { title: "設定新密碼" };

function safeNextPath(value: string | undefined, fallback: string) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ audience?: string; next?: string }> }) {
  const { audience, next } = await searchParams;
  const isAdmin = audience === "admin";
  const nextPath = safeNextPath(next, isAdmin ? "/admin" : "/");
  const loginPath = isAdmin ? `/admin-login?next=${encodeURIComponent(nextPath)}` : `/login?next=${encodeURIComponent(nextPath)}`;

  return <main className={styles.page}><section className={styles.card} aria-labelledby="reset-password-title">
    <div className={styles.eyebrow}>{isAdmin ? "GYEOT Owner" : "Member access"}</div>
    <h1 id="reset-password-title" className="serif">設定新密碼</h1>
    <p className={styles.intro}>請設定至少 8 碼的新密碼，並避免與其他網站共用。</p>
    <ResetPasswordForm />
    <div className={styles.links}><Link href={loginPath}>返回登入</Link><Link href="/">回到商城</Link></div>
  </section></main>;
}
