import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import adminStyles from "../admin.module.css";
import { updateContentAction } from "./actions";
import styles from "./content.module.css";

export const dynamic = "force-dynamic";

const pageDefinitions = [
  { slug: "about", title: "關於 GYEOT", body: "GYEOT（곁）是韓文「身邊、陪伴」的意思。我們從版型、觸感與日常搭配出發，挑選能陪你反覆穿著的韓國男裝。", published: true },
  { slug: "shopping-guide", title: "購物說明", body: "V1 支援台灣宅配、現貨與預購。混合訂單會於商品全數到齊後一次寄出。", published: true },
  { slug: "shipping", title: "配送政策", body: "第一階段僅提供台灣宅配。訂單成立後，我們會依庫存與預購到貨狀態安排出貨。", published: true },
  { slug: "returns", title: "退換貨政策", body: "此頁目前是路由骨架；正式文字必須經台灣法務確認後才能上線。", published: false },
  { slug: "contact", title: "聯絡我們", body: "如有商品、訂單或配送問題，歡迎透過客服 Email 聯繫我們。", published: true },
  { slug: "privacy", title: "隱私權政策", body: "此頁目前是路由骨架。正式版本將載明蒐集目的、資料類別、利用期間、第三方服務、跨境傳輸與當事人權利。", published: false },
  { slug: "terms", title: "服務條款", body: "此頁目前是路由骨架；正式文字必須經法務審閱。", published: false },
] as const;

function formatDate(value: string | null) {
  if (!value) return "尚未更新";
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_pages").select("slug,title,body,is_published,updated_at").order("slug");
  const pages = pageDefinitions.map((definition) => {
    const current = data?.find((row) => row.slug === definition.slug);
    return current ?? { slug: definition.slug, title: definition.title, body: definition.body, is_published: definition.published, updated_at: null };
  });

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">Brand · Owner tools</div><h1 className="serif">內容管理</h1></div><span className="badge badge-stock">公開頁面</span></div>
    <p className={adminStyles.panelIntro}>編輯品牌故事與顧客服務頁面。草稿不會出現在商城，發布後才會對訪客公開。</p>
    {params.status === "updated" && <div className={adminStyles.notice}>頁面內容已儲存。</div>}
    {(params.status === "error" || error) && <div className={styles.error}>{params.message ?? "目前無法讀取或更新內容。"}</div>}
    <div className={styles.grid}>{pages.map((page) => <section className={adminStyles.panel} key={page.slug}><div className={styles.heading}><div><span className="eyebrow">/{page.slug}</span><h2>{page.title}</h2></div><span className={`badge ${page.is_published ? "badge-stock" : "badge-preorder"}`}>{page.is_published ? "已發布" : "草稿"}</span></div><form action={updateContentAction} className={styles.form}><input type="hidden" name="slug" value={page.slug} /><label>頁面標題<input className="input" name="title" required maxLength={120} defaultValue={page.title} /></label><label>頁面內容<textarea className="input" name="body" required maxLength={12000} rows={7} defaultValue={page.body} /></label><div className={styles.actions}><label className={styles.checkbox}><input name="isPublished" type="checkbox" defaultChecked={page.is_published} /><span>公開發布</span></label><button className="button button-primary button-small" type="submit">儲存內容</button></div><small className={styles.updated}>最後更新：{formatDate(page.updated_at)}</small></form></section>)}</div>
  </>;
}

