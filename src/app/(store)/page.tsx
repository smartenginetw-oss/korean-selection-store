import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getCatalog } from "@/features/catalog/server";
import styles from "./home.module.css";

const categories = [
  { name: "TOPS", zh: "上衣", tone: "#cbb8a3" },
  { name: "BOTTOMS", zh: "下著", tone: "#aeb3a5" },
  { name: "OUTERWEAR", zh: "外套與層次", tone: "#c5aaa5" },
];

export default async function HomePage() {
  const products = (await getCatalog()).slice(0, 4);
  return <>
    <section className={styles.hero}>
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}><span className="eyebrow">Korean menswear, selected slowly</span><h1 className="serif">韓國男裝<br />穿進日常。</h1><p>從首爾街頭到台灣日常，挑選有版型、有觸感，也能反覆穿著的男裝。</p><Link className="button button-primary" href="/products">探索男裝新品</Link></div>
        <div className={styles.heroArt} aria-label="韓國男裝形象示意圖" role="img"><div className={styles.arch} /><div className={styles.heroLabel}>SEOUL · TAIPEI<br />CURATED 2026</div></div>
      </div>
    </section>

    <section className="section"><div className="container"><div className="section-head"><div><div className="eyebrow">Just arrived</div><h2 className="section-title serif">本週新選</h2></div><Link href="/products">查看全部 →</Link></div><div className={styles.productGrid}>{products.map((product) => <ProductCard key={product.id} product={product} />)}</div></div></section>

    <section className={styles.categorySection}><div className="container"><div className="eyebrow">Shop by category</div><h2 className="section-title serif">建立你的日常輪廓</h2><div className={styles.categoryGrid}>{categories.map((category) => <Link key={category.name} href={`/products?category=${category.name.toLowerCase()}`} className={styles.category} style={{ "--category-tone": category.tone } as React.CSSProperties}><span>{category.zh}</span><strong>{category.name}</strong></Link>)}</div></div></section>

    <section className="section"><div className={`container ${styles.story}`}><div className={styles.storyArt}><span>01</span><span>SELECTED<br />WITH CALM</span></div><div className={styles.storyCopy}><div className="eyebrow">Our selection</div><h2 className="section-title serif">我們相信質感<br />不需要大聲說話。</h2><p>從版型、面料到穿著情境，挑選能在工作、週末與旅途中反覆出場的男裝。</p><Link className="button button-secondary" href="/about">認識 GYEOT</Link></div></div></section>

  </>;
}
