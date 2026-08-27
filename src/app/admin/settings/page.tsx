import { requireOwner } from "@/lib/supabase/auth";
import { AccountEmailForm } from "@/components/account-email-form";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_STORE_SETTINGS } from "@/lib/store-settings";
import { siteUrl } from "@/lib/site";
import adminStyles from "../admin.module.css";
import { updateStoreSettingsAction } from "./actions";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  const { user } = await requireOwner();
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data, error }, { data: legalPages, error: legalPagesError }] = await Promise.all([
    supabase.from("store_settings").select("brand_name,support_email,shipping_fee,cvs_711_fee,cvs_family_fee,reservation_minutes,preorder_enabled,instagram_url,threads_url,facebook_url,line_official_url,updated_at").eq("id", true).maybeSingle(),
    supabase.from("store_pages").select("slug,is_published").in("slug", ["returns", "privacy", "terms"]),
  ]);
  const settings = data ?? {
    brand_name: DEFAULT_STORE_SETTINGS.brandName,
    support_email: DEFAULT_STORE_SETTINGS.supportEmail,
    shipping_fee: DEFAULT_STORE_SETTINGS.shippingFee,
    cvs_711_fee: DEFAULT_STORE_SETTINGS.cvs711Fee,
    cvs_family_fee: DEFAULT_STORE_SETTINGS.cvsFamilyFee,
    reservation_minutes: DEFAULT_STORE_SETTINGS.reservationMinutes,
    preorder_enabled: DEFAULT_STORE_SETTINGS.preorderEnabled,
    instagram_url: DEFAULT_STORE_SETTINGS.instagramUrl,
    threads_url: DEFAULT_STORE_SETTINGS.threadsUrl,
    facebook_url: DEFAULT_STORE_SETTINGS.facebookUrl,
    line_official_url: DEFAULT_STORE_SETTINGS.lineOfficialUrl,
    updated_at: null,
  };
  const legalPageCount = (legalPages ?? []).filter((page) => page.is_published).length;
  const socialLinkCount = [settings.instagram_url, settings.threads_url, settings.facebook_url, settings.line_official_url].filter(Boolean).length;
  const testPaymentEnabled = process.env.NODE_ENV !== "production" || process.env.TEST_PAYMENT_ENABLED === "true" || process.env.NEXT_PUBLIC_TEST_PAYMENT_ENABLED === "true";
  const ecpayStageEnabled = process.env.NEXT_PUBLIC_ECPAY_ENABLED === "true";
  const gaConfigured = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">商店・老闆工具</div><h1 className="serif">商店設定</h1></div><span className="badge badge-stock">後端同步</span></div>
    {params.status === "updated" && <div className={adminStyles.notice}>商店設定已儲存，新的結帳會套用最新規則。</div>}
    {(params.status === "error" || error || legalPagesError) && <div className={styles.error}>{params.message ?? "目前無法讀取或更新商店設定。"}</div>}
    <div className={styles.grid}>
      <section className={adminStyles.panel}><h2>基本設定</h2><p className={adminStyles.panelIntro}>這些設定會影響商城顯示與結帳建單。運費、預購開關與庫存保留時間會由伺服器再次驗證。</p><form action={updateStoreSettingsAction} className={styles.form}>
        <div className={styles.formGrid}><label>品牌名稱<input className="input" name="brandName" required maxLength={80} defaultValue={settings.brand_name} /></label><label>客服電子郵件<input className="input" name="supportEmail" type="email" required maxLength={254} defaultValue={settings.support_email} /></label><label>宅配運費（TWD）<input className="input" name="shippingFee" type="number" min="0" max="100000" step="1" required defaultValue={settings.shipping_fee} /></label><label>7-ELEVEN 運費（TWD）<input className="input" name="cvs711Fee" type="number" min="0" max="100000" step="1" required defaultValue={settings.cvs_711_fee} /></label><label>全家運費（TWD）<input className="input" name="cvsFamilyFee" type="number" min="0" max="100000" step="1" required defaultValue={settings.cvs_family_fee} /></label><label>庫存保留時間（分鐘）<input className="input" name="reservationMinutes" type="number" min="1" max="1440" step="1" required defaultValue={settings.reservation_minutes} /></label><label>Instagram 連結（選填）<input className="input" name="instagramUrl" type="url" placeholder="https://instagram.com/品牌帳號" maxLength={300} defaultValue={settings.instagram_url ?? ""} /></label><label>Threads 連結（選填）<input className="input" name="threadsUrl" type="url" placeholder="https://threads.net/@品牌帳號" maxLength={300} defaultValue={settings.threads_url ?? ""} /></label><label>Facebook 連結（選填）<input className="input" name="facebookUrl" type="url" placeholder="https://facebook.com/品牌帳號" maxLength={300} defaultValue={settings.facebook_url ?? ""} /></label><label>LINE 官方帳號（選填）<input className="input" name="lineOfficialUrl" type="url" placeholder="https://lin.ee/官方帳號代碼" maxLength={300} defaultValue={settings.line_official_url ?? ""} /></label></div>
        <label className={styles.checkbox}><input name="preorderEnabled" type="checkbox" defaultChecked={settings.preorder_enabled} /><span><strong>允許預購</strong><small>關閉後，預購規格無法加入新的測試訂單；既有訂單不受影響。</small></span></label>
        <button className="button button-primary" type="submit">儲存商店設定</button>
      </form></section>
      <section className={adminStyles.panel}><h2>V1 目前範圍</h2><ul className={styles.rules}><li>服務地區：台灣。</li><li>幣別：新台幣（TWD）。</li><li>配送：宅配、7-ELEVEN 與全家超商取貨。</li><li>付款：測試 adapter，不會產生真實扣款。</li><li>電子發票與統編欄位：後續版本再接入。</li></ul><p className={styles.updated}>{settings.updated_at ? `最近更新：${new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(settings.updated_at))}` : "尚未更新過設定"}</p></section>
    </div>
    <section className={adminStyles.panel}><h2>老闆帳號</h2><p className={adminStyles.panelIntro}>僅老闆可以變更登入信箱。變更會保留目前的 admin 權限與所有資料，並依 Supabase 安全設定寄出確認信。</p><AccountEmailForm currentEmail={user.email ?? ""} suggestedEmail="gyeot.official@gmail.com" /></section>
    <section className={`${adminStyles.panel} ${styles.readinessPanel}`}><div className={styles.readinessHeading}><div><h2>正式上線前檢查</h2><p className={adminStyles.panelIntro}>這些狀態只提供提醒，不會自動啟用付款或發布法律內容。</p></div><span className={`badge ${legalPageCount === 3 && !testPaymentEnabled ? "badge-stock" : "badge-preorder"}`}>{legalPageCount === 3 && !testPaymentEnabled ? "可進行最後審查" : "尚有待處理項目"}</span></div><div className={styles.readinessList}><ReadinessRow label="測試付款" detail={testPaymentEnabled ? "目前仍開啟；正式環境應關閉" : "正式環境已關閉"} ready={!testPaymentEnabled} /><ReadinessRow label="ECPay Stage" detail={ecpayStageEnabled ? "前端開關已開啟，仍需確認 Edge Function secrets 與 callback" : "目前未開啟"} ready={ecpayStageEnabled} /><ReadinessRow label="法律頁面" detail={`${legalPageCount}/3 個已發布；正式文案需先完成法務審閱`} ready={legalPageCount === 3} /><ReadinessRow label="GA4" detail={gaConfigured ? "已設定測量 ID" : "未設定（可先略過）"} ready={gaConfigured} /><ReadinessRow label="社群連結" detail={`${socialLinkCount}/4 個已設定`} ready={socialLinkCount > 0} /><ReadinessRow label="目前站點" detail={siteUrl} ready /></div></section>
  </>;
}

function ReadinessRow({ label, detail, ready }: { label: string; detail: string; ready: boolean }) {
  return <div className={styles.readinessRow}><div><strong>{label}</strong><small>{detail}</small></div><span className={`badge ${ready ? "badge-stock" : "badge-preorder"}`}>{ready ? "已完成" : "待確認"}</span></div>;
}
