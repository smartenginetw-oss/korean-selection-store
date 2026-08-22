"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/features/catalog/data";
import styles from "./products.module.css";

type AvailabilityFilter = "all" | "in_stock" | "preorder";

const filters: Array<{ value: AvailabilityFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "in_stock", label: "現貨" },
  { value: "preorder", label: "預購" },
];

export function ProductBrowser({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [sort, setSort] = useState("newest");

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products
      .filter((product) => availability === "all" || product.availability === availability)
      .filter((product) => !normalizedQuery || `${product.name} ${product.description}`.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (sort === "price-asc") return a.price - b.price;
        if (sort === "price-desc") return b.price - a.price;
        return products.indexOf(a) - products.indexOf(b);
      });
  }, [availability, products, query, sort]);

  const hasFilters = Boolean(query.trim()) || availability !== "all";

  return <>
    <div className={styles.browser}>
      <label className={styles.search}>
        <span className={styles.srOnly}>搜尋商品</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋商品" />
      </label>
      <div className={styles.toolbar}>
        <div className={styles.filterGroup} role="group" aria-label="商品狀態篩選">
          {filters.map((filter) => <button className={`${styles.filter} ${availability === filter.value ? styles.filterSelected : ""}`} type="button" key={filter.value} aria-pressed={availability === filter.value} onClick={() => setAvailability(filter.value)}>{filter.label}</button>)}
        </div>
        <label className={styles.sort}>
          <span>排序</span>
          <select className="input" aria-label="商品排序" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">最新上架</option>
            <option value="price-asc">價格低至高</option>
            <option value="price-desc">價格高至低</option>
          </select>
        </label>
      </div>
    </div>
    <div className={styles.resultMeta} aria-live="polite">
      <span>{visibleProducts.length} 件商品</span>
      {hasFilters && <button type="button" onClick={() => { setQuery(""); setAvailability("all"); }}>清除條件</button>}
    </div>
    {visibleProducts.length > 0
      ? <div className={styles.grid}>{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      : <div className={styles.empty}><strong>找不到符合條件的選品</strong><p>換個關鍵字或清除篩選，再試一次。</p><button className="button button-secondary" type="button" onClick={() => { setQuery(""); setAvailability("all"); }}>清除條件</button></div>}
  </>;
}
