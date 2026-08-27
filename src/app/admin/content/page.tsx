import { requireContent } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { localizeHomeCollection, type HomeCollection } from "@/features/home/server";
import { isContentManager } from "@/lib/supabase/roles";
import adminStyles from "../admin.module.css";
import { updateContentAction, updateHomeCollectionAction } from "./actions";
import styles from "./content.module.css";

export const dynamic = "force-dynamic";

const pageDefinitions = [
  { slug: "about", title: "關於 GYEOT", body: "GYEOT（곁）是韓文「身邊、陪伴」的意思。我們從版型、觸感與日常搭配出發，挑選能陪你反覆穿著的韓國男裝。", published: true },
  { slug: "shopping-guide", title: "購物說明", body: "目前支援台灣宅配、7-ELEVEN 與全家超商取貨，也提供現貨與預購商品。混合訂單會於商品全數到齊後一次寄出。", published: true },
  { slug: "shipping", title: "配送政策", body: "目前提供台灣宅配、7-ELEVEN 與全家超商取貨。訂單成立後，我們會依庫存與預購到貨狀態安排出貨。", published: true },
  { slug: "returns", title: "退換貨政策", body: "此頁目前是路由骨架；正式文字必須經台灣法務確認後才能上線。", published: false },
  { slug: "contact", title: "聯絡我們", body: "如有商品、訂單或配送問題，歡迎透過客服電子郵件 聯繫我們。", published: true },
  { slug: "privacy", title: "隱私權政策", body: "此頁目前是路由骨架。正式版本將載明蒐集目的、資料類別、利用期間、第三方服務、跨境傳輸與當事人權利。", published: false },
  { slug: "terms", title: "服務條款", body: "此頁目前是路由骨架；正式文字必須經法務審閱。", published: false },
] as const;

const collectionLabels: Record<HomeCollection["slug"], string> = { "new-arrivals": "新品入口", "in-stock": "現貨入口", preorder: "預購入口" };
const legalSlugs = new Set(["returns", "privacy", "terms"]);

function formatDate(value: string | null) {
  if (!value) return "尚未更新";
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  const { role } = await requireContent();
  const canManageContent = isContentManager(role);
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_pages").select("slug,title,body,is_published,updated_at").order("slug");
  const { data: collectionData, error: collectionError } = await supabase.from("store_home_collections").select("id,slug,eyebrow,title,description,href,tone,sort_order,is_published,updated_at,updated_by").order("sort_order");
  const pages = pageDefinitions.map((definition) => {
    const current = data?.find((row) => row.slug === definition.slug);
    return current ?? { slug: definition.slug, title: definition.title, body: definition.body, is_published: definition.published, updated_at: null };
  });

  const collections = (collectionData ?? []) as HomeCollection[];

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">品牌・老闆工具</div><h1 className="serif">內容管理</h1></div><span className="badge badge-stock">公開頁面</span></div>
    <p className={adminStyles.panelIntro}>編輯品牌故事與顧客服務頁面。草稿不會出現在商城，發布後才會對訪客公開。</p>
    {params.status === "updated" && <div className={adminStyles.notice}>頁面內容已儲存。</div>}
    {(params.status === "error" || error || collectionError) && <div className={styles.error}>{params.message ?? "目前無法讀取或更新內容。"}</div>}
    <div className={styles.grid}>{pages.map((page) => { const isLegalPage = legalSlugs.has(page.slug); const isReadOnly = !canManageContent; const previewHref = `/admin/content/preview/${page.slug}`; return <section className={adminStyles.panel} key={page.slug}><div className={styles.heading}><div><span className="eyebrow">/{page.slug}</span><h2>{page.title}</h2></div><div className={styles.headingActions}>{!isReadOnly && <Link className={styles.previewLink} href={previewHref} target="_blank" rel="noreferrer">預覽</Link>}<span className={`badge ${page.is_published ? "badge-stock" : "badge-preorder"}`}>{page.is_published ? "已發布" : "草稿"}</span></div></div><p className={styles.ownerOnlyNotice}>{isReadOnly ? "一般員工僅供查看；品牌內容由老闆／合夥人編輯、儲存與預覽。" : isLegalPage ? "法律頁面由老闆／合夥人共同管理，正式發布前仍需完成法務審閱。" : "你目前具備品牌內容編輯權限。"}</p><form action={updateContentAction} className={styles.form}><input type="hidden" name="slug" value={page.slug} /><label>頁面標題<input className="input" name="title" required maxLength={120} defaultValue={page.title} disabled={isReadOnly} /></label><label>頁面內容<textarea className="input" name="body" required maxLength={12000} rows={7} defaultValue={page.body} disabled={isReadOnly} /></label><div className={styles.actions}>{isReadOnly ? <span className={styles.readOnlyLabel}>僅供查看</span> : <><label className={styles.checkbox}><input name="isPublished" type="checkbox" defaultChecked={page.is_published} /><span>公開發布</span></label><button className="button button-primary button-small" type="submit">儲存內容</button></>}</div><small className={styles.updated}>最後更新：{formatDate(page.updated_at)}</small></form></section>; })}</div>
    <section className={`${adminStyles.panel} ${styles.homePanel}`}><div className={styles.sectionIntro}><div><div className="eyebrow">首頁・選品入口</div><h2>首頁選品入口</h2><p>管理首頁的新品、現貨與預購入口；連結限定為 GYEOT 站內路徑。</p><p className={styles.ownerOnlyHint}>{canManageContent ? "老闆／合夥人可編輯首頁入口。" : "一般員工僅供查看；首頁入口由老闆／合夥人編輯。"}</p></div><span className="badge badge-stock">{collections.filter((collection) => collection.is_published).length} 個公開</span></div>{collections.length > 0 ? <div className={styles.collectionGrid}>{collections.map((collection) => { const localized = localizeHomeCollection(collection); return <form action={updateHomeCollectionAction} className={`${styles.collectionCard} ${!canManageContent ? styles.collectionCardReadOnly : ""}`} key={collection.slug}><input type="hidden" name="slug" value={collection.slug} /><div className={styles.collectionCardHead}><strong>{collectionLabels[collection.slug]}</strong><span className={`badge ${collection.is_published ? "badge-stock" : "badge-preorder"}`}>{collection.is_published ? "已發布" : "草稿"}</span></div><label>眉標文字<input className="input" name="eyebrow" required maxLength={40} defaultValue={localized.eyebrow} disabled={!canManageContent} /></label><label>標題<input className="input" name="title" required maxLength={80} defaultValue={collection.title} disabled={!canManageContent} /></label><label>說明<input className="input" name="description" required maxLength={180} defaultValue={collection.description} disabled={!canManageContent} /></label><div className={styles.twoCol}><label>站內連結<input className="input" name="href" required maxLength={240} defaultValue={collection.href} disabled={!canManageContent} /></label><label>色彩代碼（HEX）<input className="input" name="tone" required pattern="^#[0-9a-fA-F]{6}$" defaultValue={collection.tone} disabled={!canManageContent} /></label></div><div className={styles.actions}>{canManageContent ? <><label className={styles.checkbox}><input name="isPublished" type="checkbox" defaultChecked={collection.is_published} /><span>公開顯示</span></label><label className={styles.order}>順序<input className="input" name="sortOrder" type="number" min={0} max={99} defaultValue={collection.sort_order} /></label><button className="button button-primary button-small" type="submit">儲存入口</button></> : <span className={styles.readOnlyLabel}>僅供查看</span>}</div><small className={styles.updated}>最後更新：{formatDate(collection.updated_at)}</small></form>; })}</div> : <p className={adminStyles.panelIntro}>目前沒有可管理的首頁入口，請確認資料庫已建立首頁選品資料。</p>}</section>
  </>;
}
