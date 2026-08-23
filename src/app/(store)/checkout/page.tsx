import Link from "next/link";
import { CheckoutForm } from "@/features/checkout/checkout-form";
import { getStoreSettings } from "@/lib/store-settings";
import styles from "./checkout.module.css";

export const metadata = { title: "結帳" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const settings = await getStoreSettings();
  return <div className={`container ${styles.page}`}><Link className={styles.back} href="/cart">← 返回購物車</Link><div className="eyebrow">Secure checkout · Preview</div><h1 className="serif">結帳</h1><CheckoutForm settings={settings} /></div>;
}
