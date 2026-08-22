import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getCatalog } from "@/features/catalog/server";
import styles from "./home.module.css";

const categories = [
  { name: "WOMEN", zh: "女裝", tone: "#cbb8a3" },
  { name: "ACCESSORIES", zh: "飾品與包款", tone: "#aeb3a5" },
  { name: "LIFESTYLE", zh: "生活選物", tone: "#c5aaa5" },
];

export default async function HomePage() {
  const products = (await getCatalog()).slice(0, 4);
  return <>
    <section className={styles.hero}>
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}><span className="eyebrow">Korean mood, selected slowly</span><h1 className="serif">韓國日常<br />溫柔選進生活。</h1><p>從首爾巷弄到日常衣櫥，挑選不喧嘩、能長久陪伴你的質感單品。</p><Link className="button button-primary" href="/products">探索本週新品</Link></div>
        <div className={styles.heroArt} aria-label="韓系選品形象示意圖" role="img"><div className={styles.arch} /><div className={styles.heroLabel}>SEOUL · TAIPEI<br />CURATED 2026</div></div>
      </div>
    </section>

    <section className="section"><div className="container"><div className="section-head"><div><div className="eyebrow">Just arrived</div><h2 className="section-title serif">本週新選</h2></div><Link href="/products">查看全部 →</Link></div><div className={styles.productGrid}>{products.map((product) => <ProductCard key={product.id} product={product} />)}</div></div></section>

    <section className={styles.categorySection}><div className="container"><div className="eyebrow">Shop by category</div><h2 className="section-title serif">找到你的日常輪廓</h2><div className={styles.categoryGrid}>{categories.map((category) => <Link key={category.name} href={`/products?category=${category.name.toLowerCase()}`} className={styles.category} style={{ "--category-tone": category.tone } as React.CSSProperties}><span>{category.zh}</span><strong>{category.name}</strong></Link>)}</div></div></section>

    <section className="section"><div className={`container ${styles.story}`}><div className={styles.storyArt}><span>01</span><span>SELECTED<br />WITH CALM</span></div><div className={styles.storyCopy}><div className="eyebrow">Our selection</div><h2 className="section-title serif">我們相信質感<br />不需要大聲說話。</h2><p>每一件選品都從版型、觸感與日常搭配開始思考。不追逐短暫熱度，只留下真正想反覆穿著與使用的東西。</p><Link className="button button-secondary" href="/about">認識 MORII</Link></div></div></section>

    <section className={styles.newsletter}><div className="container"><div><div className="eyebrow">Stay close</div><h2 className="serif">第一時間收到首爾新選</h2><p>新品、預購到貨與穿搭靈感，安靜地送到你的信箱。</p></div><form className={styles.newsletterForm}><label className={styles.srOnly} htmlFor="newsletter-email">Email</label><input className="input" id="newsletter-email" type="email" placeholder="你的 Email" /><button className="button button-primary" type="button">加入選品信</button></form></div></section>
  </>;
}
