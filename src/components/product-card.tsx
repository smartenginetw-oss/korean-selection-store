import Link from "next/link";
import type { Product } from "@/features/catalog/data";
import { formatTwd } from "@/lib/money";
import { ProductVisual } from "./product-visual";
import styles from "./product-card.module.css";

export function ProductCard({ product }: { product: Product }) {
  return <article className={styles.card}>
    <Link href={`/products/${product.slug}`} className={styles.imageLink}>
      <ProductVisual palette={product.palette} label={product.name} />
      <div className={styles.badges}>{product.badge && <span className="badge badge-new">{product.badge}</span>}<span className={`badge ${product.availability === "preorder" ? "badge-preorder" : "badge-stock"}`}>{product.availability === "preorder" ? "預購" : "現貨"}</span></div>
    </Link>
    <div className={styles.info}><Link href={`/products/${product.slug}`}>{product.name}</Link><div className={styles.swatches}>{product.colors.map((color) => <span key={color} title={color} />)}</div><div className={styles.price}>{product.originalPrice && <del>{formatTwd(product.originalPrice)}</del>}<strong>{formatTwd(product.price)}</strong></div></div>
  </article>;
}
