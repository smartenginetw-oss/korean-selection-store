import Link from "next/link";
import type { Product } from "@/features/catalog/data";
import { formatTwd } from "@/lib/money";
import { ProductVisual } from "./product-visual";
import { FavoriteButton } from "./favorite-button";
import styles from "./product-card.module.css";

export function ProductCard({ product }: { product: Product }) {
  const availabilityLabel = !product.isAvailable ? "售罄" : product.availability === "mixed" ? "現貨＋預購" : product.availability === "preorder" ? "預購" : "現貨";
  const availabilityClass = !product.isAvailable ? "badge-sold" : product.availability === "mixed" ? "badge-mixed" : product.availability === "preorder" ? "badge-preorder" : "badge-stock";
  return <article className={styles.card}>
    <div className={styles.media}><Link href={`/products/${product.slug}`} className={styles.imageLink}>
      <ProductVisual palette={product.palette} images={product.images} label={product.name} />
      <div className={styles.badges}>{product.badge && <span className="badge badge-new">{product.badge}</span>}<span className={`badge ${availabilityClass}`}>{availabilityLabel}</span></div>
    </Link><FavoriteButton compact productId={product.id} returnTo={`/products/${product.slug}`} /></div>
    <div className={styles.info}><Link href={`/products/${product.slug}`}>{product.name}</Link><div className={styles.swatches}>{product.colors.map((color) => <span key={color} title={color} />)}</div><div className={styles.price}>{product.originalPrice && <del>{formatTwd(product.originalPrice)}</del>}<strong>{formatTwd(product.price)}</strong></div></div>
  </article>;
}
