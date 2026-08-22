import { ProductCard } from "@/components/product-card";
import { getCatalog } from "@/features/catalog/server";
import styles from "./products.module.css";

export const metadata = { title: "全部商品" };

export default async function ProductsPage() {
  const products = await getCatalog();
  return <div className={`container ${styles.page}`}>
    <div className={styles.heading}><div><div className="eyebrow">All selections</div><h1 className="serif">全部商品</h1><p className="muted">共 {products.length} 件 Preview 選品</p></div><div className={styles.tools}><button className="button button-secondary button-small" type="button">篩選</button><select className="input" aria-label="商品排序" defaultValue="newest"><option value="newest">最新上架</option><option value="price-asc">價格低至高</option><option value="price-desc">價格高至低</option></select></div></div>
    <div className={styles.grid}>{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
  </div>;
}
