import Link from "next/link";
import { CheckoutForm } from "@/features/checkout/checkout-form";
import styles from "./checkout.module.css";

export const metadata = { title: "結帳" };

export default function CheckoutPage() {
  return <div className={`container ${styles.page}`}><Link className={styles.back} href="/cart">← 返回購物車</Link><div className="eyebrow">Secure checkout · Preview</div><h1 className="serif">結帳</h1><CheckoutForm /></div>;
}
