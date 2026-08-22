import Link from "next/link";
import styles from "./store-footer.module.css";

export function StoreFooter() {
  return <footer className={styles.footer}>
    <div className={`container ${styles.grid}`}>
      <div><div className={`${styles.logo} serif`}>GYEOT</div><p>陪你穿進日常的韓國男裝。</p></div>
      <div><strong>購物協助</strong><Link href="/shopping-guide">購物說明</Link><Link href="/shipping">配送政策</Link><Link href="/returns">退換貨政策</Link></div>
      <div><strong>關於我們</strong><Link href="/about">品牌故事</Link><Link href="/contact">聯絡我們</Link><Link href="/privacy">隱私權政策</Link></div>
    </div>
    <div className={`container ${styles.bottom}`}>© 2026 GYEOT · V1 Preview</div>
  </footer>;
}
