import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { signOutAdmin } from "@/app/admin/actions";
import styles from "./admin-shell.module.css";

const sections = [
  ["總覽", "/admin"], ["商品", "/admin/products"], ["新增商品", "/admin/products/new"],
  ["庫存", "/admin/inventory"], ["訂單", "/admin/orders"], ["顧客", "/admin/customers"],
  ["優惠碼", "/admin/coupons"], ["內容", "/admin/content"], ["報表", "/admin/reports"], ["設定", "/admin/settings"],
];

export function AdminShell({ children, email }: { children: React.ReactNode; email?: string }) {
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><BrandLockup href="/admin" size="md" /></div>
      <nav>{sections.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      <Link className={styles.storeLink} href="/">← 回到商城</Link>
    </aside>
    <div className={styles.content}>
      <header className={styles.header}>
        <div><span className="badge badge-preorder">PREVIEW</span></div>
        <div className={styles.adminGroup}>
          <span className={styles.admin}>{email ?? "管理員"}</span>
          <form action={signOutAdmin}><button className={styles.logout} type="submit">登出</button></form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  </div>;
}
