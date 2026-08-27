import { createClient } from "@/lib/supabase/server";
import { requireCatalog } from "@/lib/supabase/auth";
import { saveCategoryAction, toggleCategoryAction } from "./actions";
import adminStyles from "../admin.module.css";
import styles from "./categories.module.css";

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  await requireCatalog();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id,name,slug,description,sort_order,is_active")
    .order("sort_order")
    .order("name");

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">商品・老闆工具</div><h1 className="serif">商品分類</h1></div><span className="badge badge-stock">上架分類</span></div>
    {params.status === "created" && <div className={adminStyles.notice}>分類已建立，新增商品時可以直接選用。</div>}
    {params.status === "updated" && <div className={adminStyles.notice}>分類資料已更新。</div>}
    {params.status === "error" && <div className={styles.error}>{params.message ?? "操作尚未完成，請稍後再試。"}</div>}
    <div className={styles.layout}>
      <section className={adminStyles.panel}><h2>建立分類</h2><p className={adminStyles.panelIntro}>分類停用後不會出現在商城與新增商品的選單；已有商品資料不會被刪除。</p><form action={saveCategoryAction} className={styles.form}><label>分類名稱<input className="input" name="name" required maxLength={80} placeholder="例如：襯衫" /></label><label>系統代碼<input className="input" name="slug" required maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="例如：shirts" /></label><label>說明<textarea className="input" name="description" rows={3} maxLength={500} placeholder="顯示在分類頁的簡短說明（選填）" /></label><label>排序<input className="input" name="sortOrder" type="number" min={0} max={9999} defaultValue={0} /></label><button className="button button-primary" type="submit">建立分類</button></form></section>
      <section className={adminStyles.panel}><h2>管理原則</h2><ul className={styles.rules}><li>系統代碼是分類的識別值，建立後仍可修改，但請避免頻繁變更。</li><li>分類採停用而非刪除，避免歷史商品與訂單失去關聯。</li><li>只有商品／庫存與全營運員工、老闆可以管理分類。</li></ul></section>
    </div>
    <section className={adminStyles.panel}><div className={adminStyles.panelHeading}><h2>現有分類</h2><span>{categories?.length ?? 0} 組</span></div>{error ? <p className={adminStyles.empty}>分類資料目前無法讀取。</p> : categories?.length ? <div className={styles.list}>{categories.map((category) => <div className={styles.item} key={category.id}><form action={saveCategoryAction} className={styles.editForm}><input type="hidden" name="id" value={category.id} /><label>名稱<input className="input" name="name" required maxLength={80} defaultValue={category.name} /></label><label>系統代碼<input className="input" name="slug" required maxLength={80} defaultValue={category.slug} /></label><label>說明<textarea className="input" name="description" rows={2} maxLength={500} defaultValue={category.description} /></label><label>排序<input className="input" name="sortOrder" type="number" min={0} max={9999} defaultValue={category.sort_order} /></label><div className={adminStyles.inlineActions}><button className="button button-secondary button-small" type="submit">儲存</button><span className={`badge ${category.is_active ? "badge-stock" : "badge-preorder"}`}>{category.is_active ? "啟用" : "停用"}</span></div></form><form action={toggleCategoryAction} className={styles.toggleForm}><input type="hidden" name="id" value={category.id} /><input type="hidden" name="isActive" value={String(category.is_active)} /><button className="button button-secondary button-small" type="submit">{category.is_active ? "停用分類" : "重新啟用"}</button></form></div>)}</div> : <p className={adminStyles.empty}>目前尚無分類。</p>}</section>
  </>;
}
