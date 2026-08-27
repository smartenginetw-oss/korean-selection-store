import Link from "next/link";

import { AuthLoginForm } from "@/components/auth-login-form";
import styles from "./admin-login.module.css";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next, notice } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  const callbackFailed = notice === "auth_callback_failed";
  const roleRequired = notice === "admin_role_required";
  const storeAccountRedirected = notice === "admin_account_use_admin_portal";

  return <main className={`container ${styles.page}`}><div className="eyebrow">GYEOT Owner Tools</div><h1 className="serif">管理後台登入</h1>{callbackFailed && <div className={styles.notice} role="alert">登入連結已失效，請改用 Email 與密碼或 LINE 登入。</div>}{roleRequired && <div className={styles.notice} role="alert">這個帳號沒有後台權限，請使用已授權的老闆、合夥人或員工帳號。</div>}{storeAccountRedirected && <div className={styles.notice} role="alert">後台帳號請使用管理網址登入，商城會員入口不會開啟後台權限。</div>}<AuthLoginForm audience="admin" nextPath={nextPath} /><p>老闆、合夥人與員工統一使用 Email＋密碼或已授權的 LINE 登入；此入口只開放具備後台角色的帳號。</p><Link href="/">← 回到商城</Link></main>;
}
