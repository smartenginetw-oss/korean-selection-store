import { getCatalog, getPublicCategories } from "@/features/catalog/server";
import { ProductBrowser } from "./product-browser";
import styles from "./products.module.css";

export const metadata = { title: "全部商品" };

type AvailabilityFilter = "all" | "in_stock" | "preorder";
type SortFilter = "newest" | "popular" | "price-asc" | "price-desc";
type PriceFilter = "all" | "under-500" | "500-1000" | "over-1000";
const validAvailability = new Set<AvailabilityFilter>(["all", "in_stock", "preorder"]);
const validSorts = new Set<SortFilter>(["newest", "popular", "price-asc", "price-desc"]);
const validPrices = new Set<PriceFilter>(["all", "under-500", "500-1000", "over-1000"]);

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<{ q?: string | string[]; category?: string | string[]; availability?: string | string[]; price?: string | string[]; sort?: string | string[] }> }) {
  const [products, categories] = await Promise.all([getCatalog(), getPublicCategories()]);
  const params = searchParams ? await searchParams : {};
  const queryParam = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const categoryParam = typeof params.category === "string" ? params.category : undefined;
  const initialCategory = categoryParam && categories.some((category) => category.slug === categoryParam) ? categoryParam : "all";
  const availabilityParam = typeof params.availability === "string" ? params.availability : undefined;
  const initialAvailability: AvailabilityFilter = availabilityParam && validAvailability.has(availabilityParam as AvailabilityFilter) ? availabilityParam as AvailabilityFilter : "all";
  const sortParam = typeof params.sort === "string" ? params.sort : undefined;
  const initialSort: SortFilter = sortParam && validSorts.has(sortParam as SortFilter) ? sortParam as SortFilter : "newest";
  const priceParam = typeof params.price === "string" ? params.price : undefined;
  const initialPrice: PriceFilter = priceParam && validPrices.has(priceParam as PriceFilter) ? priceParam as PriceFilter : "all";
  return <div className={`container ${styles.page}`}>
    <div className={styles.heading}><div><div className="eyebrow">GYEOT menswear</div><h1 className="serif">全部男裝</h1><p className="muted">探索上衣、下著、外套與配件</p></div></div>
    <ProductBrowser products={products} categories={categories} initialQuery={queryParam} initialCategory={initialCategory} initialAvailability={initialAvailability} initialPrice={initialPrice} initialSort={initialSort} />
  </div>;
}
