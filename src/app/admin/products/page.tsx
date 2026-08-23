import Link from "next/link";
import { getAdminProductSummaries } from "@/features/catalog/admin/server";
import { formatTwd } from "@/lib/money";
import styles from "../admin.module.css";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ created?: string; images?: string }> }) {
  const { created, images } = await searchParams;
  const imageCount = Number(images ?? 0);
  const { products, error } = await getAdminProductSummaries();
  return <><div className={styles.titleRow}><div><div className="eyebrow">Catalog · Supabase</div><h1 className="serif">所有商品</h1></div><Link className="button button-primary" href="/admin/products/new">新增商品</Link></div>{created && <div className={styles.notice}>商品「{created}」已建立{imageCount > 0 ? `，已上傳 ${imageCount} 張圖片。` : "。"}</div>}{error && <div className={styles.notice}>{error}</div>}<section className={styles.panel}><table className={styles.table}><thead><tr><th>商品</th><th>狀態</th><th>模式</th><th>售價</th><th>規格</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><br /><small>{product.slug}</small></td><td><span className={`badge ${product.status === "active" ? "badge-stock" : "badge-preorder"}`}>{product.status === "active" ? "上架" : product.status === "draft" ? "草稿" : "封存"}</span></td><td>{product.availability === "mixed" ? "現貨＋預購" : product.availability === "preorder" ? "預購" : product.availability === "in_stock" ? "現貨" : "未設定"}</td><td>{formatTwd(product.salePrice)}</td><td>{product.variantCount}</td></tr>)}</tbody></table>{!products.length && !error && <p className={styles.empty}>目前尚無商品。</p>}</section></>;
}
