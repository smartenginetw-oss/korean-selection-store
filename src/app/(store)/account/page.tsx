import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAddressAction, deleteAddressAction, setDefaultAddressAction, signOutMember, updateProfileAction } from "./actions";
import styles from "./account.module.css";

export const metadata = { title: "會員中心" };
export const dynamic = "force-dynamic";

const paymentLabels: Record<string, string> = { pending: "待付款", paid: "已付款", failed: "付款失敗", refunded: "已退款", partially_refunded: "部分退款" };
const fulfillmentLabels: Record<string, string> = { unfulfilled: "待處理", awaiting_stock: "等待到貨", processing: "處理中", shipped: "已出貨", delivered: "已送達", cancelled: "已取消" };
const taiwanCities = [
  "基隆市", "台北市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣", "台中市", "彰化縣", "南投縣", "雲林縣",
  "嘉義市", "嘉義縣", "台南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "台東縣", "澎湖縣", "金門縣", "連江縣",
] as const;

function formatTwd(value: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-TW", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount");

  const [profileResult, addressResult, ordersResult, favoritesResult] = await Promise.all([
    supabase.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle(),
    supabase.from("addresses").select("id, recipient_name, phone, postal_code, city, district, address_line, is_default").eq("profile_id", user.id).order("is_default", { ascending: false }).order("updated_at", { ascending: false }),
    supabase.from("orders").select("id, order_number, created_at, grand_total, currency, payment_status, fulfillment_status, order_status, stock_mode").order("created_at", { ascending: false }).limit(30),
    supabase.from("favorites").select("product_id, created_at").order("created_at", { ascending: false }).limit(60),
  ]);

  const profile = profileResult.data;
  const orders = ordersResult.data ?? [];
  const addresses = addressResult.data ?? [];
  const favoriteRows = favoritesResult.data ?? [];
  const favoriteProductIds = favoriteRows.map((favorite) => favorite.product_id);
  const favoriteProductsResult = favoriteProductIds.length
    ? await supabase.from("products").select("id, name, slug, sale_price").in("id", favoriteProductIds)
    : { data: [], error: null };
  const favoriteProducts = new Map((favoriteProductsResult.data ?? []).map((product) => [product.id, product]));
  const displayName = profile?.display_name || user.user_metadata?.display_name || "GYEOT 會員";
  const statusMessages: Record<string, string> = {
    profile_saved: "基本資料已更新。",
    address_saved: "宅配地址已儲存。",
    address_deleted: "宅配地址已刪除。",
    profile_error: "基本資料更新失敗，請確認姓名與手機格式。",
    address_error: "地址資料不完整或無法更新，請重新確認。",
  };
  const statusMessage = status ? statusMessages[status] : undefined;
  const isStatusError = status?.endsWith("_error") ?? false;

  return <div className={`container ${styles.page}`}>
    <div className={styles.titleRow}>
      <div><div className="eyebrow">Member file · GYEOT</div><h1 className="serif">會員中心</h1></div>
      <form action={signOutMember}><button className="button button-secondary" type="submit">登出會員帳號</button></form>
    </div>
    {statusMessage && <div className={isStatusError ? styles.notice : styles.status} role={isStatusError ? "alert" : "status"}>{statusMessage}</div>}
    {profileResult.error && <div className={styles.notice}>會員資料目前無法完整讀取，訂單與帳號仍可安全使用。</div>}
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="profile-heading">
        <h2 id="profile-heading">基本資料</h2>
        <form className={styles.form} action={updateProfileAction}>
          <div className="field"><label htmlFor="member-display-name">姓名</label><input className="input" id="member-display-name" name="displayName" defaultValue={displayName} required maxLength={80} /></div>
          <div className="field"><label htmlFor="member-phone">手機</label><input className="input" id="member-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={profile?.phone ?? ""} required pattern="09[0-9]{8}" placeholder="0912345678" /></div>
          <button className="button button-secondary button-small" type="submit">儲存基本資料</button>
        </form>
        <div className={styles.profile}>
          <div className={styles.profileRow}><span>Email</span><strong>{user.email}</strong></div>
        </div>
        <p className={styles.hint}>Email 是登入識別，無法在此修改；手機僅接受台灣手機格式。</p>
      </section>

      <section className={styles.panel} aria-labelledby="address-heading">
        <h2 id="address-heading">宅配地址</h2>
        {addresses.length ? <div className={styles.addressList}>{addresses.map((address) => <div className={styles.address} key={address.id}>
          <div className={styles.addressHeader}><strong>{address.recipient_name} · {address.phone}</strong><div className={styles.addressActions}>{address.is_default && <span className="badge badge-stock">預設</span>}{!address.is_default && <form action={setDefaultAddressAction}><input type="hidden" name="addressId" value={address.id} /><button className={styles.textButton} type="submit">設為預設</button></form>}<form action={deleteAddressAction}><input type="hidden" name="addressId" value={address.id} /><button className={`${styles.textButton} ${styles.dangerButton}`} type="submit">刪除</button></form></div></div>
          <p>{address.postal_code} {address.city}{address.district}{address.address_line}</p>
        </div>)}</div> : <p className={styles.empty}>尚未儲存地址。結帳時可直接填寫宅配資訊。</p>}
        <details className={styles.addAddress}><summary>新增宅配地址</summary><form className={styles.form} action={createAddressAction}>
          <div className={styles.formGrid}><div className="field"><label htmlFor="member-recipient">收件人</label><input className="input" id="member-recipient" name="recipientName" required maxLength={80} /></div><div className="field"><label htmlFor="member-address-phone">手機</label><input className="input" id="member-address-phone" name="phone" type="tel" inputMode="tel" required pattern="09[0-9]{8}" placeholder="0912345678" /></div></div>
          <div className={styles.formGrid}><div className="field"><label htmlFor="member-city">縣市</label><select className="input" id="member-city" name="city" required defaultValue=""><option value="" disabled>請選擇</option>{taiwanCities.map((city) => <option key={city}>{city}</option>)}</select></div><div className="field"><label htmlFor="member-district">區域</label><input className="input" id="member-district" name="district" required maxLength={30} /></div></div>
          <div className={styles.formGrid}><div className="field"><label htmlFor="member-postal">郵遞區號</label><input className="input" id="member-postal" name="postalCode" inputMode="numeric" required minLength={3} maxLength={6} /></div><div className="field"><label htmlFor="member-address-line">地址</label><input className="input" id="member-address-line" name="addressLine" autoComplete="street-address" required maxLength={160} /></div></div>
          <label className={styles.checkbox}><input type="checkbox" name="isDefault" />設為預設地址</label>
          <button className="button button-secondary button-small" type="submit">儲存地址</button>
        </form></details>
        <p className={styles.hint}>V1 僅提供台灣宅配；地址操作只會影響你自己的會員資料。</p>
      </section>

      <section className={`${styles.panel} ${styles.orders}`} aria-labelledby="orders-heading">
        <h2 id="orders-heading">我的訂單</h2>
        {orders.length ? <div className={styles.orderList}>{orders.map((order) => <Link className={styles.order} href={`/account/orders/${order.id}`} key={order.id}>
          <div className={styles.orderMain}><strong>{order.order_number}</strong><span>{formatDate(order.created_at)} · {fulfillmentLabels[order.fulfillment_status] ?? order.fulfillment_status}</span></div>
          <div className={styles.orderAside}><strong>{formatTwd(order.grand_total)}</strong><span>{paymentLabels[order.payment_status] ?? order.payment_status}</span></div>
        </Link>)}</div> : <p className={styles.empty}>目前還沒有綁定到這個會員的訂單；訪客結帳仍可正常完成。</p>}
      </section>

      <section className={`${styles.panel} ${styles.favorites}`} aria-labelledby="favorites-heading">
        <h2 id="favorites-heading">收藏清單</h2>
        {favoriteRows.length ? <div className={styles.favoriteList}>{favoriteRows.map((favorite) => {
          const product = favoriteProducts.get(favorite.product_id);
          return product ? <Link className={styles.favorite} href={`/products/${product.slug}`} key={favorite.product_id}><strong>{product.name}</strong><span>{formatTwd(product.sale_price)} · 查看商品 →</span></Link> : null;
        })}</div> : <p className={styles.empty}>還沒有收藏商品。看到喜歡的款式，可以在商品卡或商品頁按下愛心。</p>}
        {favoriteRows.length > 0 && !favoriteProducts.size && <p className={styles.empty}>收藏的商品目前已下架或無法公開顯示。</p>}
      </section>
    </div>
  </div>;
}
