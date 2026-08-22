import Link from "next/link";
import { products } from "@/features/catalog/data";
import { formatTwd } from "@/lib/money";
import styles from "../admin.module.css";

export default function AdminProductsPage() { return <><div className={styles.titleRow}><div><div className="eyebrow">Catalog · Demo data</div><h1 className="serif">所有商品</h1></div><Link className="button button-primary" href="/admin/products/new">新增商品</Link></div><section className={styles.panel}><table className={styles.table}><thead><tr><th>商品</th><th>狀態</th><th>模式</th><th>售價</th><th>規格</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><br /><small>{product.slug}</small></td><td><span className="badge badge-stock">上架</span></td><td>{product.availability === "preorder" ? "預購" : "現貨"}</td><td>{formatTwd(product.price)}</td><td>{product.colors.length * product.sizes.length}</td></tr>)}</tbody></table></section></>; }
