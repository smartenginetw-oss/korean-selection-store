import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signOutMember } from "./actions";
import styles from "./account.module.css";

export const metadata = { title: "會員中心" };
export const dynamic = "force-dynamic";

const paymentLabels: Record<string, string> = { pending: "待付款", paid: "已付款", failed: "付款失敗", refunded: "已退款", partially_refunded: "部分退款" };
const fulfillmentLabels: Record<string, string> = { unfulfilled: "待處理", awaiting_stock: "等待到貨", processing: "處理中", shipped: "已出貨", delivered: "已送達", cancelled: "已取消" };

function formatTwd(value: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-TW", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount");

  const [profileResult, addressResult, ordersResult] = await Promise.all([
    supabase.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle(),
    supabase.from("addresses").select("id, recipient_name, phone, postal_code, city, district, address_line, is_default").eq("profile_id", user.id).order("is_default", { ascending: false }).order("updated_at", { ascending: false }),
    supabase.from("orders").select("id, order_number, created_at, grand_total, currency, payment_status, fulfillment_status, order_status, stock_mode").order("created_at", { ascending: false }).limit(30),
  ]);

  const profile = profileResult.data;
  const orders = ordersResult.data ?? [];
  const addresses = addressResult.data ?? [];
  const displayName = profile?.display_name || user.user_metadata?.display_name || "GYEOT 會員";

  return <div className={`container ${styles.page}`}>
    <div className={styles.titleRow}>
      <div><div className="eyebrow">Member file · GYEOT</div><h1 className="serif">會員中心</h1></div>
      <form action={signOutMember}><button className="button button-secondary" type="submit">登出會員帳號</button></form>
    </div>
    {profileResult.error && <div className={styles.notice}>會員資料目前無法完整讀取，訂單與帳號仍可安全使用。</div>}
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="profile-heading">
        <h2 id="profile-heading">基本資料</h2>
        <div className={styles.profile}>
          <div className={styles.profileRow}><span>姓名</span><strong>{displayName}</strong></div>
          <div className={styles.profileRow}><span>Email</span><strong>{user.email}</strong></div>
          <div className={styles.profileRow}><span>手機</span><strong>{profile?.phone || "尚未填寫"}</strong></div>
        </div>
        <p className={styles.hint}>目前先保留安全的會員查詢；手機與姓名可在後續會員設定補上編輯流程。</p>
      </section>

      <section className={styles.panel} aria-labelledby="address-heading">
        <h2 id="address-heading">宅配地址</h2>
        {addresses.length ? <div className={styles.addressList}>{addresses.map((address) => <div className={styles.address} key={address.id}>
          <div className={styles.addressHeader}><strong>{address.recipient_name} · {address.phone}</strong>{address.is_default && <span className="badge badge-stock">預設</span>}</div>
          <p>{address.postal_code} {address.city}{address.district}{address.address_line}</p>
        </div>)}</div> : <p className={styles.empty}>尚未儲存地址。結帳時可直接填寫宅配資訊。</p>}
        <p className={styles.hint}>V1 僅提供台灣宅配；地址管理介面會沿用同一組會員資料權限。</p>
      </section>

      <section className={`${styles.panel} ${styles.orders}`} aria-labelledby="orders-heading">
        <h2 id="orders-heading">我的訂單</h2>
        {orders.length ? <div className={styles.orderList}>{orders.map((order) => <Link className={styles.order} href={`/account/orders/${order.id}`} key={order.id}>
          <div className={styles.orderMain}><strong>{order.order_number}</strong><span>{formatDate(order.created_at)} · {fulfillmentLabels[order.fulfillment_status] ?? order.fulfillment_status}</span></div>
          <div className={styles.orderAside}><strong>{formatTwd(order.grand_total)}</strong><span>{paymentLabels[order.payment_status] ?? order.payment_status}</span></div>
        </Link>)}</div> : <p className={styles.empty}>目前還沒有綁定到這個會員的訂單；訪客結帳仍可正常完成。</p>}
      </section>
    </div>
  </div>;
}
