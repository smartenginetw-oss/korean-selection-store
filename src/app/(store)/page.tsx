import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getCatalog } from "@/features/catalog/server";
import { getHomeCollections } from "@/features/home/server";
import { getPublicCategories } from "@/features/catalog/server";
import styles from "./home.module.css";

const categoryTones = ["#cbb8a3", "#aeb3a5", "#c5aaa5", "#b9a9a0", "#b6a99a"] as const;

export default async function HomePage() {
  const [catalog, collections, publicCategories] = await Promise.all([getCatalog(), getHomeCollections(), getPublicCategories()]);
  const categories = publicCategories.map((category, index) => ({ ...category, tone: categoryTones[index % categoryTones.length] }));
  const products = catalog.slice(0, 4);
  const popularProducts = [...catalog]
    .filter((product) => product.isAvailable && (product.soldQuantity ?? 0) > 0)
    .sort((a, b) => (b.soldQuantity ?? 0) - (a.soldQuantity ?? 0))
    .slice(0, 4);
  return <>
    <section className={styles.hero}>
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}><span className="eyebrow">Korean menswear, selected slowly</span><h1 className="serif">韓國男裝<br />穿進日常。</h1><p>從首爾街頭到台灣日常，挑選有版型、有觸感，也能反覆穿著的男裝。</p><Link className="button button-primary" href="/products">探索男裝新品</Link></div>
        <div className={styles.heroArt} aria-label="韓國男裝形象示意圖" role="img"><div className={styles.arch} /><div className={styles.heroLabel}>SEOUL · TAIPEI<br />CURATED 2026</div></div>
      </div>
    </section>

    <section className="section"><div className="container"><div className="section-head"><div><div className="eyebrow">Just arrived</div><h2 className="section-title serif">本週新選</h2></div><Link href="/products">查看全部 →</Link></div>{products.length > 0 ? <div className={styles.productGrid}>{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className={styles.emptyCatalog} role="status"><strong>商品正在準備中</strong><p>我們正在整理下一批韓國男裝，請稍後再回來看看。</p><Link className="button button-secondary" href="/products">前往商品列表</Link></div>}</div></section>

    {popularProducts.length > 0 && <section className={styles.hotSection}><div className="container"><div className="section-head"><div><div className="eyebrow">Most loved</div><h2 className="section-title serif">近期熱賣</h2></div><Link href="/products?sort=popular">查看熱賣 →</Link></div><div className={styles.productGrid}>{popularProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div></div></section>}

    {collections.length > 0 && <section className={styles.collectionSection}><div className="container"><div className="eyebrow">Find your pace</div><h2 className="section-title serif">依照你的購買節奏選品</h2><div className={styles.collectionGrid}>{collections.map((collection) => <Link key={collection.href} href={collection.href} className={styles.collection} style={{ "--collection-tone": collection.tone } as React.CSSProperties}><span className="eyebrow">{collection.eyebrow}</span><strong>{collection.title}</strong><small>{collection.description}</small><span className={styles.collectionArrow}>→</span></Link>)}</div></div></section>}

    {categories.length > 0 && <section className={styles.categorySection}><div className="container"><div className="eyebrow">Shop by category</div><h2 className="section-title serif">建立你的日常輪廓</h2><div className={styles.categoryGrid}>{categories.map((category) => <Link key={category.slug} href={`/products?category=${encodeURIComponent(category.slug)}`} className={styles.category} style={{ "--category-tone": category.tone } as React.CSSProperties}><span>{category.name}</span><strong>{category.slug.toUpperCase()}</strong></Link>)}</div></div></section>}

    <section className="section"><div className={`container ${styles.story}`}><div className={styles.storyArt}><span>01</span><span>SELECTED<br />WITH CALM</span></div><div className={styles.storyCopy}><div className="eyebrow">Our selection</div><h2 className="section-title serif">我們相信質感<br />不需要大聲說話。</h2><p>從版型、面料到穿著情境，挑選能在工作、週末與旅途中反覆出場的男裝。</p><Link className="button button-secondary" href="/about">認識 GYEOT</Link></div></div></section>

  </>;
}
