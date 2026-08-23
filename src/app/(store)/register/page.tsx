import Link from "next/link";

import { AuthRegisterForm } from "@/components/auth-register-form";
import styles from "./register.module.css";

export const metadata = { title: "建立會員" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  return <div className={`container ${styles.page}`}>
    <div className={styles.frame}>
      <section className={styles.intro}><div className="eyebrow">Member file · GYEOT</div><h1 className="serif">建立你的<br />選品檔案。</h1><p>建立會員後，可以在 GYEOT 查看自己的訂單與宅配資訊；不登入也仍然可以使用訪客結帳。</p></section>
      <section className={styles.formPanel} aria-label="建立會員表單"><AuthRegisterForm nextPath={nextPath} /><div className={styles.links}><Link href={`/login?next=${encodeURIComponent(nextPath)}`}>已有會員？登入 →</Link><Link href="/">← 回到商城</Link></div></section>
    </div>
  </div>;
}
