import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { ProductVisual } from "@/components/product-visual";
import { getCatalog, getProductBySlug } from "@/features/catalog/server";
import { ProductPurchasePanel } from "@/features/catalog/product-purchase-panel";
import { formatTwd } from "@/lib/money";
import styles from "./product.module.css";

export async function generateStaticParams() {
  const products = await getCatalog();
  return products.map(({ slug }) => ({ slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const products = await getCatalog();
  return <div className={`container ${styles.page}`}>
    <div className={styles.main}>
      <div className={styles.gallery}><ProductVisual large palette={product.palette} images={product.images} label={product.name} /><div className={styles.thumbs}><span /><span /><span /></div></div>
      <div className={styles.info}><div className={styles.badges}>{product.badge && <span className="badge badge-new">{product.badge}</span>}<span className={`badge ${product.availability === "preorder" ? "badge-preorder" : "badge-stock"}`}>{product.availability === "preorder" ? "預購" : "現貨"}</span></div><h1 className="serif">{product.name}</h1><div className={styles.price}>{product.originalPrice && <del>{formatTwd(product.originalPrice)}</del>}<strong>{formatTwd(product.price)}</strong></div><p className={styles.description}>{product.description}</p><ProductPurchasePanel product={product} /><div className={styles.details}><details open><summary>商品資訊</summary><p>柔軟親膚材質，版型以韓國選品原始尺寸為準。正式資料將由 Admin 商品欄位提供。</p></details><details><summary>配送與預購</summary><p>V1 僅提供台灣宅配。混合現貨與預購商品將於全數到齊後一次寄出。</p></details><details><summary>退換貨說明</summary><p>正式營運前將補入經法務確認的完整政策。</p></details></div></div>
    </div>
    <section className={styles.related}><div className="section-head"><h2 className="section-title serif">你可能也喜歡</h2></div><div className={styles.relatedGrid}>{products.filter(({ id }) => id !== product.id).slice(0, 3).map((item) => <ProductCard key={item.id} product={item} />)}</div></section>
  </div>;
}
