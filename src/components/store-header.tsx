"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/features/cart/cart-provider";
import styles from "./store-header.module.css";

const navigation = [
  ["NEW", "/products?sort=newest"],
  ["WOMEN", "/products?category=women"],
  ["MEN", "/products?category=men"],
  ["ACCESSORIES", "/products?category=accessories"],
  ["LIFESTYLE", "/products?category=lifestyle"],
];

export function StoreHeader() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <button className={styles.menuButton} type="button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}>
          <span aria-hidden="true">{open ? "×" : "☰"}</span><span className={styles.srOnly}>選單</span>
        </button>
        <Link className={`${styles.logo} serif`} href="/">MORII</Link>
        <nav className={styles.desktopNav} aria-label="主要導覽">
          {navigation.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
        </nav>
        <div className={styles.actions}>
          <Link href="/products" aria-label="搜尋商品">⌕</Link>
          <Link href="/login" aria-label="會員帳號">♙</Link>
          <Link className={styles.cart} href="/cart" aria-label={`購物車，共 ${count} 件商品`}>袋<span>{count}</span></Link>
        </div>
      </div>
      {open && <nav id="mobile-navigation" className={styles.mobileNav} aria-label="手機導覽">
        {navigation.map(([label, href]) => <Link key={label} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
        <Link href="/about" onClick={() => setOpen(false)}>ABOUT</Link>
      </nav>}
    </header>
  );
}
