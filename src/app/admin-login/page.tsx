import Link from "next/link";

import { AuthLoginForm } from "@/components/auth-login-form";
import styles from "./admin-login.module.css";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";

  return <main className={`container ${styles.page}`}><div className="eyebrow">GYEOT Owner</div><h1 className="serif">老闆／員工登入</h1><AuthLoginForm audience="admin" nextPath={nextPath} /><p>此入口只開放被授予後台權限的帳號。未來新增員工時，請建立個別帳號，不要共用登入資訊。</p><Link href="/">← 回到商城</Link></main>;
}
