import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { signOutAdmin } from "@/app/admin/actions";
import { BackofficeCapability, BackofficeRole, canAccess, roleLabel } from "@/lib/supabase/roles";
import styles from "./admin-shell.module.css";

const sections: Array<[string, string, BackofficeCapability | null]> = [
  ["總覽", "/admin", null], ["商品", "/admin/products", "catalog"], ["新增商品", "/admin/products/new", "catalog"],
  ["商品分類", "/admin/categories", "catalog"],
  ["供應商", "/admin/suppliers", "procurement"], ["廠商報價", "/admin/quotations", "procurement"], ["採購單", "/admin/purchase-orders", "procurement"],
  ["庫存", "/admin/inventory", "inventory"], ["訂單", "/admin/orders", "orders"], ["顧客管理", "/admin/customers", "customers"],
  ["優惠碼管理", "/admin/coupons", "coupons"], ["內容管理", "/admin/content", "content"], ["報表分析", "/admin/reports", "reports"],
];

export function AdminShell({ children, email, role }: { children: React.ReactNode; email?: string; role: BackofficeRole }) {
  const isOwner = role === "admin";
  const visibleSections = sections.filter(([, , capability]) => !capability || canAccess(role, capability));
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><BrandLockup href="/admin" size="md" /></div>
      <nav>{visibleSections.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}{isOwner && <><Link href="/admin/settings">商店設定</Link><Link href="/admin/staff">團隊管理</Link></>}</nav>
      <Link className={styles.storeLink} href="/">← 回到商城</Link>
    </aside>
    <div className={styles.content}>
      <header className={styles.header}>
        <div><span className="badge badge-preorder">預覽環境</span></div>
        <div className={styles.adminGroup}>
          <span className={`badge ${isOwner ? "badge-stock" : "badge-preorder"}`}>{roleLabel(role)}</span>
          <span className={styles.admin}>{email ?? "老闆"}</span>
          <form action={signOutAdmin}><button className={styles.logout} type="submit">登出</button></form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  </div>;
}
