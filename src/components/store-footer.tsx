import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import type { StoreSettings } from "@/lib/store-settings";
import styles from "./store-footer.module.css";

const shopLinks = [
  ["全部男裝", "/products"],
  ["本週新選", "/products?sort=newest"],
  ["上衣", "/products?category=tops"],
  ["下著", "/products?category=bottoms"],
  ["外套", "/products?category=outerwear"],
  ["配件", "/products?category=accessories"],
] as const;

const memberLinks = [
  ["會員登入", "/login"],
  ["購物車", "/cart"],
  ["購物說明", "/shopping-guide"],
  ["配送政策", "/shipping"],
  ["退換貨政策", "/returns"],
] as const;

export function StoreFooter({ settings }: { settings: Pick<StoreSettings, "brandName" | "supportEmail"> }) {
  return <footer className={styles.footer}>
    <div className={`container ${styles.inner}`}>
      <div className={styles.intro}>
        <div className="eyebrow">Curated in Seoul · Worn in Taipei</div>
        <BrandLockup size="lg" />
        <p>選一套，出門。<br />陪你穿進日常的韓國男裝。</p>
      </div>

      <div className={styles.columns}>
        <FooterColumn index="01" title="選購" english="SHOP" links={shopLinks} />
        <FooterColumn index="02" title="會員與服務" english="ACCOUNT" links={memberLinks} />
        <div className={styles.column}>
          <div className={styles.columnHeading}><span>03</span><div><strong>關於 GYEOT</strong><small>CONNECT</small></div></div>
          <div className={styles.linkList}>
            <Link href="/about">品牌故事</Link>
            <Link href="/contact">聯絡我們</Link>
            <Link href="/privacy">隱私權政策</Link>
            <Link href="/terms">服務條款</Link>
            <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
          </div>
        </div>
      </div>

      <div className={styles.signature} aria-hidden="true">
        <span>곁</span>
        <small>STAY CLOSE · KEEP IT SIMPLE</small>
      </div>

      <div className={styles.bottom}>
        <span>{settings.brandName} 곁 · 2026</span>
        <span>台灣限定宅配 · TWD</span>
      </div>
    </div>
  </footer>;
}

function FooterColumn({ index, title, english, links }: { index: string; title: string; english: string; links: readonly (readonly [string, string])[] }) {
  return <div className={styles.column}>
    <div className={styles.columnHeading}><span>{index}</span><div><strong>{title}</strong><small>{english}</small></div></div>
    <div className={styles.linkList}>{links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div>
  </div>;
}
