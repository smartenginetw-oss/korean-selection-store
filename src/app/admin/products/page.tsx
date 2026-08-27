import Link from "next/link";
import { RoundedSelect } from "@/components/rounded-select";
import { DeleteProductButton } from "./delete-product-button";
import { ProductStatusButton } from "./product-status-button";
import { getAdminProductSummaries, parseAdminProductStatus } from "@/features/catalog/admin/server";
import { formatTwd } from "@/lib/money";
import styles from "../admin.module.css";

const productStatusOptions = [{ value: "", label: "全部" }, { value: "active", label: "上架" }, { value: "draft", label: "草稿" }, { value: "archived", label: "封存" }] as const;

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ created?: string; updated?: string; images?: string; status?: string; q?: string }> }) {
  const { created, updated, images, status, q } = await searchParams;
  const imageCount = Number(images ?? 0);
  const statusFilter = parseAdminProductStatus(status);
  const { products, error } = await getAdminProductSummaries({ query: q, status: statusFilter });
  const hasFilters = Boolean(q?.trim() || statusFilter);
  return <><div className={styles.titleRow}><div><div className="eyebrow">商品・資料庫</div><h1 className="serif">所有商品</h1></div><Link className="button button-primary" href="/admin/products/new">新增商品</Link></div>{created && <div className={styles.notice}>商品「{created}」已建立{imageCount > 0 ? `，已上傳 ${imageCount} 張圖片。` : "。"}</div>}{updated && <div className={styles.notice}>商品「{updated}」已更新{imageCount > 0 ? `，已上傳 ${imageCount} 張圖片。` : "。"}</div>}{status === "updated" && <div className={styles.notice}>商品狀態已更新。</div>}{error && <div className={styles.notice}>{error}</div>}<section className={styles.panel}><form className={styles.filters} method="get"><label htmlFor="product-search">搜尋商品</label><input className="input" id="product-search" name="q" defaultValue={q ?? ""} placeholder="名稱或系統代碼" maxLength={80} /><label htmlFor="product-status">狀態</label><RoundedSelect id="product-status" name="status" options={productStatusOptions} defaultValue={statusFilter ?? ""} ariaLabel="商品狀態" /><button className="button button-secondary button-small" type="submit">篩選</button>{hasFilters && <Link className="button button-secondary button-small" href="/admin/products">清除篩選</Link>}</form><table className={styles.table}><thead><tr><th>商品</th><th>狀態</th><th>供貨狀態</th><th>售價</th><th>規格</th><th>操作</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><br /><small>{product.slug}</small></td><td><span className={`badge ${product.status === "active" ? "badge-stock" : "badge-preorder"}`}>{product.status === "active" ? "上架" : product.status === "draft" ? "草稿" : "封存"}</span></td><td>{product.availability === "mixed" ? "現貨＋預購" : product.availability === "preorder" ? "預購" : product.availability === "in_stock" ? "現貨" : "售罄"}</td><td>{formatTwd(product.salePrice)}</td><td>{product.variantCount}</td><td><div className={styles.inlineActions}><Link className="button button-secondary button-small" href={`/admin/products/${product.id}/edit`}>編輯</Link><ProductStatusButton productId={product.id} status={product.status} /><DeleteProductButton productId={product.id} status={product.status} /></div></td></tr>)}</tbody></table>{!products.length && !error && <p className={styles.empty}>{hasFilters ? "找不到符合條件的商品。" : "目前尚無商品。"}</p>}</section></>;
}
