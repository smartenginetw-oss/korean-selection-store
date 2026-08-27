import { requireProcurement } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import adminStyles from "../admin.module.css";
import { saveSupplierAction, toggleSupplierAction } from "./actions";
import styles from "./suppliers.module.css";

export const dynamic = "force-dynamic";

function fieldValue(value: string | null) {
  return value ?? "";
}

export default async function AdminSuppliersPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  await requireProcurement();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id,name,country,contact_name,phone,email,line,kakao,payment_terms,note,is_active,created_at,updated_at")
    .order("is_active", { ascending: false })
    .order("name");

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">採購・營運工具</div><h1 className="serif">供應商</h1></div><span className="badge badge-stock">V1.5 採購</span></div>
    {params.status === "created" && <div className={adminStyles.notice}>供應商已建立，之後可在廠商報價與採購單選用。</div>}
    {params.status === "updated" && <div className={adminStyles.notice}>供應商資料已更新。</div>}
    {params.status === "error" && <div className={styles.error}>{params.message ?? "操作尚未完成，請稍後再試。"}</div>}
    <div className={styles.layout}>
      <section className={adminStyles.panel}>
        <h2>新增供應商</h2>
        <p className={adminStyles.panelIntro}>先建立韓國供應商基本資料；報價、採購單與到貨驗收會沿用同一筆供應商。</p>
        <form action={saveSupplierAction} className={styles.form}>
          <div className={styles.twoColumns}>
            <label>供應商名稱<input className="input" name="name" required maxLength={160} placeholder="例如：Seoul Select Co." /></label>
            <label>國家／地區<input className="input" name="country" required maxLength={80} defaultValue="韓國" /></label>
            <label>聯絡人<input className="input" name="contactName" maxLength={80} placeholder="選填" /></label>
            <label>電話<input className="input" name="phone" maxLength={40} placeholder="選填" /></label>
            <label>Email<input className="input" name="email" type="email" maxLength={254} placeholder="選填" /></label>
            <label>LINE<input className="input" name="line" maxLength={80} placeholder="LINE ID（選填）" /></label>
            <label>KakaoTalk<input className="input" name="kakao" maxLength={80} placeholder="KakaoTalk ID（選填）" /></label>
            <label>付款條件<input className="input" name="paymentTerms" maxLength={240} placeholder="例如：月結 30 天" /></label>
          </div>
          <label>備註<textarea className="input" name="note" rows={4} maxLength={2000} placeholder="報價習慣、出貨備註或合作紀錄（選填）" /></label>
          <button className="button button-primary" type="submit">建立供應商</button>
        </form>
      </section>
      <section className={adminStyles.panel}>
        <h2>資料原則</h2>
        <ul className={styles.rules}>
          <li>供應商資料只對老闆、合夥人與全營運員工開放。</li>
          <li>停用供應商不會刪除歷史報價或採購紀錄。</li>
          <li>供應商聯絡資料不會出現在商城、會員或公開 API。</li>
        </ul>
      </section>
    </div>
    <section className={adminStyles.panel}>
      <div className={adminStyles.panelHeading}><h2>目前供應商</h2><span>{suppliers?.length ?? 0} 家</span></div>
      {error ? <p className={adminStyles.empty}>供應商資料目前無法讀取。</p> : suppliers?.length ? <div className={styles.list}>{suppliers.map((supplier) => <div className={styles.item} key={supplier.id}>
        <form action={saveSupplierAction} className={styles.editForm}>
          <input type="hidden" name="id" value={supplier.id} />
          <div className={styles.itemHeading}><div><strong>{supplier.name}</strong><small>{supplier.country} · 最後更新 {new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium" }).format(new Date(supplier.updated_at))}</small></div><span className={`badge ${supplier.is_active ? "badge-stock" : "badge-preorder"}`}>{supplier.is_active ? "啟用" : "停用"}</span></div>
          <div className={styles.twoColumns}>
            <label>供應商名稱<input className="input" name="name" required maxLength={160} defaultValue={supplier.name} /></label>
            <label>國家／地區<input className="input" name="country" required maxLength={80} defaultValue={supplier.country} /></label>
            <label>聯絡人<input className="input" name="contactName" maxLength={80} defaultValue={fieldValue(supplier.contact_name)} /></label>
            <label>電話<input className="input" name="phone" maxLength={40} defaultValue={fieldValue(supplier.phone)} /></label>
            <label>Email<input className="input" name="email" type="email" maxLength={254} defaultValue={fieldValue(supplier.email)} /></label>
            <label>LINE<input className="input" name="line" maxLength={80} defaultValue={fieldValue(supplier.line)} /></label>
            <label>KakaoTalk<input className="input" name="kakao" maxLength={80} defaultValue={fieldValue(supplier.kakao)} /></label>
            <label>付款條件<input className="input" name="paymentTerms" maxLength={240} defaultValue={fieldValue(supplier.payment_terms)} /></label>
          </div>
          <label>備註<textarea className="input" name="note" rows={3} maxLength={2000} defaultValue={fieldValue(supplier.note)} /></label>
          <div className={adminStyles.inlineActions}><button className="button button-secondary button-small" type="submit">儲存</button></div>
        </form>
        <form action={toggleSupplierAction} className={styles.toggleForm}><input type="hidden" name="id" value={supplier.id} /><input type="hidden" name="isActive" value={String(supplier.is_active)} /><button className="button button-secondary button-small" type="submit">{supplier.is_active ? "停用供應商" : "重新啟用"}</button></form>
      </div>)}</div> : <p className={adminStyles.empty}>目前尚無供應商，先從上方建立第一家。</p>}
    </section>
  </>;
}
