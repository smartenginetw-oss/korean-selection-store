import { requireOwner } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { BackofficeRole, EMPLOYEE_ROLES, isBackofficeRole, roleDescription, roleLabel } from "@/lib/supabase/roles";
import adminStyles from "../admin.module.css";
import { setStaffMemberAction } from "./actions";
import styles from "./staff.module.css";

export const dynamic = "force-dynamic";

type StaffRow = { userId: string; email: string; displayName: string | null; role: BackofficeRole; createdAt: string; lastSignInAt: string | null };

function isStaffRow(value: unknown): value is StaffRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.userId === "string" && typeof row.email === "string" && isBackofficeRole(row.role) && typeof row.createdAt === "string";
}

function formatDate(value: string | null) {
  if (!value) return "尚未登入";
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminStaffPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  await requireOwner();
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_backoffice_users");
  const rows = Array.isArray(data) ? data.filter(isStaffRow) : [];

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">Team · Owner only</div><h1 className="serif">團隊管理</h1></div><span className="badge badge-stock">老闆專用</span></div>
    <p className={adminStyles.panelIntro}>每位員工都使用自己的 Supabase Auth 帳號，不共用老闆登入。先提供兩種專責角色，也保留「全營運員工」給需要跨模組處理的人。</p>
    {params.status === "updated" && <div className={adminStyles.notice}>員工權限已更新。</div>}
    {(params.status === "error" || error) && <div className={styles.error}>{params.message ?? "目前無法讀取團隊資料。"}</div>}
    <div className={styles.grid}>
      <section className={adminStyles.panel}><h2>授予／撤銷員工權限</h2><p className={adminStyles.panelIntro}>請先在 Supabase Authentication 建立帳號，再輸入相同 Email。撤銷後會恢復為一般會員，既有訂單不受影響。</p><form action={setStaffMemberAction} className={styles.form}><label>Email<input className="input" name="email" type="email" required maxLength={254} placeholder="staff@example.com" /></label><div className={styles.actions}><select className="input" name="role" defaultValue="catalog_staff" aria-label="角色"><option value="catalog_staff">商品／庫存</option><option value="order_staff">訂單／客服</option><option value="staff">全營運員工</option><option value="customer">撤銷後台權限</option></select><button className="button button-primary" type="submit">更新權限</button></div></form><div className={styles.roleCards}>{EMPLOYEE_ROLES.map((employeeRole) => <div className={styles.roleCard} key={employeeRole}><strong>{roleLabel(employeeRole)}</strong><span>{roleDescription(employeeRole)}</span></div>)}</div></section>
      <section className={adminStyles.panel}><h2>安全提醒</h2><ul className={styles.rules}><li>老闆帳號不能由此頁降級。</li><li>員工不會看到團隊管理與商店設定入口。</li><li>帳號停用、密碼重設與邀請信仍在 Supabase Authentication 管理。</li></ul></section>
    </div>
    <section className={adminStyles.panel}><div className={adminStyles.panelHeading}><h2>目前後台帳號</h2><span>{rows.length} 位</span></div>{rows.length ? <div className={adminStyles.tableScroll}><table className={adminStyles.table}><thead><tr><th>帳號</th><th>角色</th><th>可處理範圍</th><th>建立時間</th><th>最近登入</th><th>操作</th></tr></thead><tbody>{rows.map((row) => <tr key={row.userId}><td><strong>{row.displayName || "未設定名稱"}</strong><br /><small>{row.email}</small></td><td><span className={`badge ${row.role === "admin" ? "badge-stock" : "badge-preorder"}`}>{roleLabel(row.role)}</span></td><td>{roleDescription(row.role)}</td><td>{formatDate(row.createdAt)}</td><td>{formatDate(row.lastSignInAt)}</td><td>{row.role !== "admin" ? <form action={setStaffMemberAction}><input type="hidden" name="email" value={row.email} /><input type="hidden" name="role" value="customer" /><button className="button button-secondary button-small" type="submit">撤銷權限</button></form> : <span className={styles.ownerLabel}>不可降級</span>}</td></tr>)}</tbody></table></div> : <p className={adminStyles.empty}>目前沒有後台帳號資料。</p>}</section>
  </>;
}
