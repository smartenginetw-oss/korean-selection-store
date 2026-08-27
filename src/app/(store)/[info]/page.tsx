import { notFound } from "next/navigation";
import { requireContentManager } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/store-settings";
import styles from "./info.module.css";

const pages: Record<string, { title: string; body: string }> = {
  about: { title: "關於 GYEOT", body: "GYEOT（곁）是韓文「身邊、陪伴」的意思。我們從版型、觸感與日常搭配出發，挑選能陪你反覆穿著的韓國男裝。" },
  "shopping-guide": { title: "購物說明", body: "目前支援台灣宅配、7-ELEVEN 與全家超商取貨，也提供現貨與預購商品。混合訂單會於商品全數到齊後一次寄出。" },
  shipping: { title: "配送政策", body: "目前提供台灣宅配、7-ELEVEN 與全家超商取貨。實際運費會依結帳時選擇的配送方式計算；含預購商品的訂單將於商品全數到齊後一次寄出。" },
  returns: { title: "退換貨政策", body: "此頁目前是路由骨架；正式文字必須經台灣法務確認後才能上線。" },
  contact: { title: "聯絡我們", body: "客服 Email、服務時間與品牌聯絡資料待營運方提供。" },
  privacy: { title: "隱私權政策", body: "此頁目前是路由骨架。正式版本將載明蒐集目的、資料類別、利用期間、第三方服務、跨境傳輸與當事人權利。" },
  terms: { title: "服務條款", body: "此頁目前是路由骨架；正式文字必須經法務審閱。" },
};

export default async function InfoPage({ params, searchParams }: { params: Promise<{ info: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { info } = await params;
  const page = pages[info];
  if (!page) notFound();

  const previewRequested = (await searchParams).preview === "1";
  if (previewRequested) await requireContentManager();

  const supabase = await createClient();
  const pageQuery = supabase.from("store_pages").select("title,body,is_published,updated_at").eq("slug", info);
  const [{ data: publishedPage }, settings] = await Promise.all([
    (previewRequested ? pageQuery : pageQuery.eq("is_published", true)).maybeSingle(),
    getStoreSettings(),
  ]);
  const title = publishedPage?.title ?? page.title;
  const body = publishedPage?.body ?? page.body;
  const settingsNote = info === "contact" ? `客服 Email：${settings.supportEmail}` : info === "shipping" ? `目前運費：宅配 NT$${settings.shippingFee}／7-ELEVEN NT$${settings.cvs711Fee}／全家 NT$${settings.cvsFamilyFee}` : null;
  const isDraft = !publishedPage && ["returns", "privacy", "terms"].includes(info);
  const isPrivatePreview = previewRequested && publishedPage?.is_published === false;

  return <article className={`container ${styles.page}`}>{isPrivatePreview && <div className={styles.previewNotice}>管理員預覽：此內容尚未對訪客公開。</div>}<div className="eyebrow">GYEOT guide</div><h1 className="serif">{title}</h1><div className={styles.body}>{body}</div>{settingsNote && <p className={styles.settingsNote}>{settingsNote}</p>}{isDraft && <div className={styles.placeholder}>內容待正式營運資料確認</div>}</article>;
}
