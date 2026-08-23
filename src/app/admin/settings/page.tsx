import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_STORE_SETTINGS } from "@/lib/store-settings";
import adminStyles from "../admin.module.css";
import { updateStoreSettingsAction } from "./actions";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_settings").select("brand_name,support_email,shipping_fee,reservation_minutes,preorder_enabled,updated_at").eq("id", true).maybeSingle();
  const settings = data ?? {
    brand_name: DEFAULT_STORE_SETTINGS.brandName,
    support_email: DEFAULT_STORE_SETTINGS.supportEmail,
    shipping_fee: DEFAULT_STORE_SETTINGS.shippingFee,
    reservation_minutes: DEFAULT_STORE_SETTINGS.reservationMinutes,
    preorder_enabled: DEFAULT_STORE_SETTINGS.preorderEnabled,
    updated_at: null,
  };

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">Store · Owner tools</div><h1 className="serif">商店設定</h1></div><span className="badge badge-stock">後端同步</span></div>
    {params.status === "updated" && <div className={adminStyles.notice}>商店設定已儲存，新的結帳會套用最新規則。</div>}
    {(params.status === "error" || error) && <div className={styles.error}>{params.message ?? "目前無法讀取或更新商店設定。"}</div>}
    <div className={styles.grid}>
      <section className={adminStyles.panel}><h2>基本設定</h2><p className={adminStyles.panelIntro}>這些設定會影響商城顯示與結帳建單。運費、預購開關與庫存保留時間會由伺服器再次驗證。</p><form action={updateStoreSettingsAction} className={styles.form}>
        <div className={styles.formGrid}><label>品牌名稱<input className="input" name="brandName" required maxLength={80} defaultValue={settings.brand_name} /></label><label>客服 Email<input className="input" name="supportEmail" type="email" required maxLength={254} defaultValue={settings.support_email} /></label><label>宅配運費（TWD）<input className="input" name="shippingFee" type="number" min="0" max="100000" step="1" required defaultValue={settings.shipping_fee} /></label><label>庫存保留時間（分鐘）<input className="input" name="reservationMinutes" type="number" min="1" max="1440" step="1" required defaultValue={settings.reservation_minutes} /></label></div>
        <label className={styles.checkbox}><input name="preorderEnabled" type="checkbox" defaultChecked={settings.preorder_enabled} /><span><strong>允許預購</strong><small>關閉後，預購規格無法加入新的測試訂單；既有訂單不受影響。</small></span></label>
        <button className="button button-primary" type="submit">儲存商店設定</button>
      </form></section>
      <section className={adminStyles.panel}><h2>V1 目前範圍</h2><ul className={styles.rules}><li>服務地區：台灣。</li><li>幣別：新台幣（TWD）。</li><li>配送：宅配。</li><li>付款：測試 adapter，不會產生真實扣款。</li><li>電子發票與統編欄位：後續版本再接入。</li></ul><p className={styles.updated}>{settings.updated_at ? `最近更新：${new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(settings.updated_at))}` : "尚未更新過設定"}</p></section>
    </div>
  </>;
}

