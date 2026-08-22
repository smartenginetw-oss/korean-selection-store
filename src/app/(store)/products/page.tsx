import { getCatalog } from "@/features/catalog/server";
import { ProductBrowser } from "./product-browser";
import styles from "./products.module.css";

export const metadata = { title: "全部商品" };

export default async function ProductsPage() {
  const products = await getCatalog();
  return <div className={`container ${styles.page}`}>
    <div className={styles.heading}><div><div className="eyebrow">All selections</div><h1 className="serif">全部商品</h1><p className="muted">探索現貨與預購的日常選品</p></div></div>
    <ProductBrowser products={products} />
  </div>;
}
