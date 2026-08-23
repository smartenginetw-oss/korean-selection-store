import Link from "next/link";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";

  return <div className={`container ${styles.page}`}><div className="eyebrow">GYEOT Admin</div><h1 className="serif">管理員登入</h1><LoginForm nextPath={nextPath} /><p>使用 Supabase Auth 安全登入。只有被授予 <code>admin</code> 角色的帳號可以進入後台。</p><Link href="/">← 回到商城</Link></div>;
}
