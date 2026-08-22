import { productCategories, type ProductCategory } from "@/features/catalog/data";
import { getCatalog } from "@/features/catalog/server";
import { ProductBrowser } from "./product-browser";
import styles from "./products.module.css";

export const metadata = { title: "全部商品" };

const validCategories = new Set<ProductCategory>(productCategories);

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<{ category?: string | string[] }> }) {
  const products = await getCatalog();
  const params = searchParams ? await searchParams : {};
  const categoryParam = typeof params.category === "string" ? params.category : undefined;
  const initialCategory = categoryParam && validCategories.has(categoryParam as ProductCategory) ? categoryParam as ProductCategory : "all";
  return <div className={`container ${styles.page}`}>
    <div className={styles.heading}><div><div className="eyebrow">GYEOT menswear</div><h1 className="serif">全部男裝</h1><p className="muted">探索上衣、下著、外套與配件</p></div></div>
    <ProductBrowser products={products} initialCategory={initialCategory} />
  </div>;
}
