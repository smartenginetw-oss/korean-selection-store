import Link from "next/link";
import { CheckoutForm } from "@/features/checkout/checkout-form";
import { getStoreSettings } from "@/lib/store-settings";
import { createClient } from "@/lib/supabase/server";
import styles from "./checkout.module.css";

export const metadata = { title: "結帳" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [settings, supabase] = await Promise.all([getStoreSettings(), createClient()]);
  const testPaymentEnabled = process.env.NEXT_PUBLIC_TEST_PAYMENT_ENABLED === "true" || process.env.NODE_ENV !== "production";
  const ecpayEnabled = process.env.NEXT_PUBLIC_ECPAY_ENABLED === "true";
  const { data: { user } } = await supabase.auth.getUser();
  let prefill;
  if (user) {
    const [profileResult, addressResult] = await Promise.all([
      supabase.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle(),
      supabase.from("addresses").select("recipient_name, phone, postal_code, city, district, address_line").eq("profile_id", user.id).eq("is_default", true).maybeSingle(),
    ]);
    const profile = profileResult.data;
    const address = addressResult.data;
    prefill = {
      displayName: profile?.display_name || user.user_metadata?.display_name || "",
      email: user.email || "",
      phone: profile?.phone || address?.phone || "",
      address: address ? {
        recipientName: address.recipient_name,
        phone: address.phone,
        postalCode: address.postal_code,
        city: address.city,
        district: address.district,
        addressLine: address.address_line,
      } : undefined,
    };
  }
  return <div className={`container ${styles.page}`}><Link className={styles.back} href="/cart">← 返回購物車</Link><div className="eyebrow">Secure checkout · Preview</div><h1 className="serif">結帳</h1><CheckoutForm settings={settings} prefill={prefill} testPaymentEnabled={testPaymentEnabled} ecpayEnabled={ecpayEnabled} /></div>;
}
