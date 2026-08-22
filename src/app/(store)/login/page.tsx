import Link from "next/link";
import styles from "./login.module.css";

export default function LoginPage() { return <div className={`container ${styles.page}`}><div className="eyebrow">Account foundation</div><h1 className="serif">會員登入</h1><form><div className="field"><label htmlFor="login-email">Email</label><input className="input" id="login-email" type="email" autoComplete="email" /></div><div className="field"><label htmlFor="login-password">密碼</label><input className="input" id="login-password" type="password" autoComplete="current-password" /></div><button className="button button-primary" type="button">登入 Preview</button></form><p>Supabase Auth 尚未連線。正式版會加入安全 Session 與 Admin MFA。</p><Link href="/">← 回到商城</Link></div>; }
