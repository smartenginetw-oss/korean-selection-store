import Link from "next/link";
import { notFound } from "next/navigation";

import { requireContentManager } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import adminStyles from "../../../admin.module.css";
import styles from "./preview.module.css";

const contentPages: Record<string, { title: string; body: string }> = {
  about: { title: "關於 GYEOT", body: "GYEOT（곁）是韓文「身邊、陪伴」的意思。我們從版型、觸感與日常搭配出發，挑選能陪你反覆穿著的韓國男裝。" },
  "shopping-guide": { title: "購物說明", body: "目前支援台灣宅配、7-ELEVEN 與全家超商取貨，也提供現貨與預購商品。混合訂單會於商品全數到齊後一次寄出。" },
  shipping: { title: "配送政策", body: "目前提供台灣宅配、7-ELEVEN 與全家超商取貨。訂單成立後，我們會依庫存與預購到貨狀態安排出貨。" },
  returns: { title: "退換貨政策", body: "此頁目前是路由骨架；正式文字必須經台灣法務確認後才能上線。" },
  contact: { title: "聯絡我們", body: "如有商品、訂單或配送問題，歡迎透過客服電子郵件聯繫我們。" },
  privacy: { title: "隱私權政策", body: "此頁目前是路由骨架。正式版本將載明蒐集目的、資料類別、利用期間、第三方服務、跨境傳輸與當事人權利。" },
  terms: { title: "服務條款", body: "此頁目前是路由骨架；正式文字必須經法務審閱。" },
};

export const dynamic = "force-dynamic";

export default async function LegalPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireContentManager();
  const { slug } = await params;
  const fallback = contentPages[slug];
  if (!fallback) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("store_pages").select("title,body,is_published,updated_at").eq("slug", slug).maybeSingle();
  const title = data?.title ?? fallback.title;
  const body = data?.body ?? fallback.body;

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">內容頁面・老闆／合夥人預覽</div><h1 className="serif">{title}</h1></div><Link className="button button-secondary button-small" href="/admin/content">返回內容管理</Link></div>
    <div className={styles.notice}>這是管理站內的老闆／合夥人專用預覽，不會對商城訪客公開。</div>
    <article className={`${adminStyles.panel} ${styles.preview}`}><div className={styles.meta}>{data?.is_published ? "目前狀態：已發布" : "目前狀態：草稿"}</div><div className={styles.body}>{body}</div><div className={styles.footer}>最後更新：{data?.updated_at ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updated_at)) : "尚未更新"}</div></article>
  </>;
}
