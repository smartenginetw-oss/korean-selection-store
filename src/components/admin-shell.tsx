import Link from "next/link";
import styles from "./admin-shell.module.css";

const sections = [
  ["總覽", "/admin"], ["商品", "/admin/products"], ["新增商品", "/admin/products/new"],
  ["庫存", "/admin/inventory"], ["訂單", "/admin/orders"], ["顧客", "/admin/customers"],
  ["優惠碼", "/admin/coupons"], ["內容", "/admin/content"], ["報表", "/admin/reports"], ["設定", "/admin/settings"],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}><aside className={styles.sidebar}><Link className={`${styles.logo} serif`} href="/admin">MORII <small>ADMIN</small></Link><nav>{sections.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav><Link className={styles.storeLink} href="/">← 回到商城</Link></aside><div className={styles.content}><header className={styles.header}><div><span className="badge badge-preorder">PREVIEW</span></div><div className={styles.admin}>管理員 Demo</div></header><main>{children}</main></div></div>;
}
