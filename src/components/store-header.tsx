"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/features/cart/cart-provider";
import styles from "./store-header.module.css";

const navigation = [
  ["NEW", "/products?sort=newest"],
  ["ALL", "/products"],
  ["TOPS", "/products?category=tops"],
  ["BOTTOMS", "/products?category=bottoms"],
  ["OUTERWEAR", "/products?category=outerwear"],
  ["ACCESSORIES", "/products?category=accessories"],
];

function Icon({ name }: { name: "search" | "account" | "bag" }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    account: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    bag: <><path d="M5 8.5h14l-1 12H6l-1-12Z" /><path d="M9 8.5V6a3 3 0 0 1 6 0v2.5" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function StoreHeader() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <button className={styles.menuButton} type="button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}>
          <span aria-hidden="true">{open ? "×" : "☰"}</span><span className={styles.srOnly}>選單</span>
        </button>
        <Link className={`${styles.logo} serif`} href="/">GYEOT</Link>
        <nav className={styles.desktopNav} aria-label="主要導覽">
          {navigation.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
        </nav>
        <div className={styles.actions}>
          <Link className={styles.iconLink} href="/products" aria-label="搜尋商品" title="搜尋商品"><Icon name="search" /></Link>
          <Link className={styles.iconLink} href="/login" aria-label="會員帳號" title="會員帳號"><Icon name="account" /></Link>
          <Link className={`${styles.iconLink} ${styles.cart}`} href="/cart" aria-label={`購物車，共 ${count} 件商品`} title="購物車"><Icon name="bag" /><span>{count}</span></Link>
        </div>
      </div>
      {open && <nav id="mobile-navigation" className={styles.mobileNav} aria-label="手機導覽">
        <div className={styles.mobileNavGroup}>
          <span className={styles.mobileNavTitle}>探索選品</span>
          {navigation.map(([label, href]) => <Link className={styles.mobileNavLink} key={label} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
        </div>
        <div className={styles.mobileNavGroup}>
          <span className={styles.mobileNavTitle}>品牌資訊</span>
          <Link className={styles.mobileNavLink} href="/about" onClick={() => setOpen(false)}>ABOUT</Link>
          <Link className={styles.mobileNavLink} href="/shopping-guide" onClick={() => setOpen(false)}>購物說明</Link>
        </div>
      </nav>}
    </header>
  );
}
