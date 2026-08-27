import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import type { StoreSettings } from "@/lib/store-settings";
import styles from "./store-footer.module.css";

const companyLinks = [
  ["品牌故事", "/about"],
  ["隱私權政策", "/privacy"],
  ["會員中心", "/account"],
  ["服務條款", "/terms"],
] as const;

const serviceLinks = [
  ["購物說明", "/shopping-guide"],
  ["配送政策", "/shipping"],
  ["退換貨政策", "/returns"],
] as const;

export function StoreFooter({ settings }: { settings: Pick<StoreSettings, "brandName" | "supportEmail" | "instagramUrl" | "threadsUrl" | "facebookUrl" | "lineOfficialUrl"> }) {
  return <footer className={styles.footer}>
    <div className={`container ${styles.inner}`}>
      <div className={styles.footerBrand}>
        <BrandLockup href="/" size="md" />
        <p>Curated in Seoul · Worn in Taipei</p>
      </div>

      <div className={styles.columns}>
        <FooterColumn title="品牌" english="COMPANY" links={companyLinks} />
        <FooterColumn title="服務" english="SERVICE" links={serviceLinks} />
        <div className={styles.column}><h2>聯絡我們</h2><div className={styles.contact}><p>週一至週五／09:00–18:00</p><a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a><span>台灣限定宅配 · TWD</span>{(settings.instagramUrl || settings.threadsUrl || settings.facebookUrl || settings.lineOfficialUrl) && <div className={styles.socialLinks} aria-label="社群連結">{settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>}{settings.threadsUrl && <a href={settings.threadsUrl} target="_blank" rel="noreferrer">Threads</a>}{settings.facebookUrl && <a href={settings.facebookUrl} target="_blank" rel="noreferrer">Facebook</a>}{settings.lineOfficialUrl && <a href={settings.lineOfficialUrl} target="_blank" rel="noreferrer">LINE 官方帳號</a>}</div>}</div></div>
      </div>

      <div className={styles.meta} aria-label="商店語言與幣別">
        <span>NT$ TWD⌄</span>
        <span>◎ 繁體中文⌄</span>
      </div>

      <div className={styles.bottom}>
        <span>{settings.brandName} 곁 · 2026</span>
        <span>© {settings.brandName} ALL RIGHTS RESERVED</span>
      </div>
    </div>
  </footer>;
}

function FooterColumn({ title, english, links }: { title: string; english: string; links: readonly (readonly [string, string])[] }) {
  return <div className={styles.column}>
    <div className={styles.columnHeading}><strong>{title}</strong><small>{english}</small></div>
    <div className={styles.linkList}>{links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div>
  </div>;
}
