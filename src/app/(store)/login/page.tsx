import Link from "next/link";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return <div className={`container ${styles.page}`}><div className="eyebrow">GYEOT Member</div><h1 className="serif">會員登入</h1><LoginForm nextPath={nextPath} /><p>已有會員帳號即可登入；尚未註冊也可以直接以訪客身份完成結帳。</p><div className={styles.links}><Link href="/admin-login">管理員／員工後台登入</Link><Link href="/">← 回到商城</Link></div></div>;
}
