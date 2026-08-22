import { notFound } from "next/navigation";
import styles from "./info.module.css";

const pages: Record<string, { title: string; body: string }> = {
  about: { title: "關於 GYEOT", body: "GYEOT（곁）是韓文「身邊、陪伴」的意思。我們從版型、觸感與日常搭配出發，挑選能陪你反覆穿著的韓國男裝。" },
  "shopping-guide": { title: "購物說明", body: "V1 支援台灣宅配、現貨與預購。混合訂單會於商品全數到齊後一次寄出。" },
  shipping: { title: "配送政策", body: "第一階段僅提供台灣宅配。運費與免運門檻將於正式營運前確認。" },
  returns: { title: "退換貨政策", body: "此頁目前是路由骨架；正式文字必須經台灣法務確認後才能上線。" },
  contact: { title: "聯絡我們", body: "客服 Email、服務時間與品牌聯絡資料待營運方提供。" },
  privacy: { title: "隱私權政策", body: "此頁目前是路由骨架。正式版本將載明蒐集目的、資料類別、利用期間、第三方服務、跨境傳輸與當事人權利。" },
  terms: { title: "服務條款", body: "此頁目前是路由骨架；正式文字必須經法務審閱。" },
};

export default async function InfoPage({ params }: { params: Promise<{ info: string }> }) { const { info } = await params; const page = pages[info]; if (!page) notFound(); return <article className={`container ${styles.page}`}><div className="eyebrow">GYEOT guide</div><h1 className="serif">{page.title}</h1><p>{page.body}</p><div className={styles.placeholder}>內容待正式營運資料確認</div></article>; }
