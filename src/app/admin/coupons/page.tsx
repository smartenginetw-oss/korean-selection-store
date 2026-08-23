import { createClient } from "@/lib/supabase/server";
import { requireCoupons } from "@/lib/supabase/auth";
import { formatTwd } from "@/lib/money";
import { createCouponAction, toggleCouponAction } from "./actions";
import { CouponDatePicker } from "./coupon-date-picker";
import styles from "./coupons.module.css";
import adminStyles from "../admin.module.css";

function formatDate(value: string | null) {
  if (!value) return "不限時間";
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminCouponsPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  await requireCoupons();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: coupons, error } = await supabase.from("coupons").select("id,code,discount_type,discount_value,minimum_subtotal,usage_limit,usage_count,starts_at,ends_at,is_active,created_at").order("created_at", { ascending: false });

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">Growth · Owner tools</div><h1 className="serif">優惠碼管理</h1></div><span className="badge badge-stock">伺服器驗證</span></div>
    {params.status === "created" && <div className={adminStyles.notice}>優惠碼已建立，結帳時會由伺服器檢查使用條件。</div>}
    {params.status === "updated" && <div className={adminStyles.notice}>優惠碼狀態已更新。</div>}
    {params.status === "error" && <div className={styles.error}>{params.message ?? "操作尚未完成，請稍後再試。"}</div>}
    <div className={styles.grid}>
      <section className={adminStyles.panel}><h2>建立優惠碼</h2><p className={adminStyles.panelIntro}>V1 支援固定金額或百分比折扣，可設定最低消費、使用次數與有效期間。</p><form action={createCouponAction} className={styles.form}>
        <div className={styles.formGrid}><label>代碼<input className="input" name="code" required maxLength={40} placeholder="GYEOT10" /></label><label>折扣類型<select className="input" name="discountType" defaultValue="percent"><option value="percent">百分比折扣</option><option value="fixed">固定金額（TWD）</option></select></label><label>折扣數值<input className="input" name="discountValue" type="number" min="1" max="1000000" required defaultValue="10" /></label><label>最低消費（TWD）<input className="input" name="minimumSubtotal" type="number" min="0" max="1000000" defaultValue="0" /></label><label>使用次數上限（選填）<input className="input" name="usageLimit" type="number" min="1" max="1000000" placeholder="不限次數" /></label><label>開始時間（選填）<CouponDatePicker name="startsAt" label="開始時間" /></label><label>結束時間（選填）<CouponDatePicker name="endsAt" label="結束時間" /></label></div>
        <button className="button button-primary" type="submit">建立並啟用</button>
      </form></section>
      <section className={adminStyles.panel}><h2>使用規則</h2><ul className={styles.rules}><li>優惠碼會在結帳交易內鎖定並驗證，前端不能自行改價。</li><li>同一張訂單只套用一組優惠碼，折扣不會超過商品小計。</li><li>使用次數在訂單成功建立時累計，失敗交易會自動回滾。</li></ul></section>
    </div>
    <section className={adminStyles.panel}><div className={adminStyles.panelHeading}><h2>已建立的優惠碼</h2><span>{coupons?.length ?? 0} 組</span></div>{error ? <p className={adminStyles.empty}>優惠碼資料目前無法讀取。</p> : coupons?.length ? <div className={adminStyles.tableScroll}><table className={adminStyles.table}><thead><tr><th>代碼</th><th>折扣</th><th>門檻</th><th>使用次數</th><th>有效期間</th><th>狀態</th><th>操作</th></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon.id}><td><strong>{coupon.code}</strong></td><td>{coupon.discount_type === "percent" ? `${coupon.discount_value}%` : formatTwd(coupon.discount_value)}</td><td>{coupon.minimum_subtotal ? `滿 ${formatTwd(coupon.minimum_subtotal)}` : "無門檻"}</td><td>{coupon.usage_count}{coupon.usage_limit ? `／${coupon.usage_limit}` : "／不限"}</td><td><small>{formatDate(coupon.starts_at)}<br />至 {formatDate(coupon.ends_at)}</small></td><td><span className={`badge ${coupon.is_active ? "badge-stock" : "badge-preorder"}`}>{coupon.is_active ? "啟用" : "停用"}</span></td><td><form action={toggleCouponAction}><input type="hidden" name="id" value={coupon.id} /><input type="hidden" name="isActive" value={String(coupon.is_active)} /><button className="button button-secondary button-small" type="submit">{coupon.is_active ? "停用" : "啟用"}</button></form></td></tr>)}</tbody></table></div> : <p className={adminStyles.empty}>目前尚無優惠碼。</p>}</section>
  </>;
}
