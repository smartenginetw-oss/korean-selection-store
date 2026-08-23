import Link from "next/link";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return <div className={`container ${styles.page}`}>
    <div className={styles.frame}>
      <section className={styles.intro}>
        <div className="eyebrow">Member file · GYEOT</div>
        <h1 className="serif">回到你的<br />日常選品。</h1>
        <p>會員入口保持簡單，只用 Email 登入。還沒準備好註冊，也可以直接以訪客身份完成結帳。</p>
        <div className={styles.notes}>
          <div><span>01</span><p><strong>MEMBER</strong> 一個帳號，保留你的購物脈絡。</p></div>
          <div><span>02</span><p><strong>GUEST</strong> 不登入，也能直接購物與結帳。</p></div>
          <div><span>03</span><p><strong>NOTE</strong> 目前提供安全的 Email 登入。</p></div>
        </div>
      </section>
      <section className={styles.formPanel} aria-label="會員登入表單">
        <div className={styles.panelHeader}><span>MEMBER ACCESS</span><span>01 / 01</span></div>
        <LoginForm nextPath={nextPath} />
        <div className={styles.guestNote}>還沒有會員？<Link href="/products">先逛逛男裝 →</Link></div>
        <div className={styles.links}><Link href="/">← 回到商城</Link><Link href="/shopping-guide">購物說明</Link></div>
      </section>
    </div>
  </div>;
}
