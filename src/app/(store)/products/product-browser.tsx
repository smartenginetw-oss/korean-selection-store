"use client";

import { useEffect, useMemo, useState } from "react";
import { RoundedSelect } from "@/components/rounded-select";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/features/catalog/data";
import type { PublicCategory } from "@/features/catalog/server";
import styles from "./products.module.css";

type AvailabilityFilter = "all" | "in_stock" | "preorder";
type CategoryFilter = "all" | string;
type SortFilter = "newest" | "popular" | "price-asc" | "price-desc";
type PriceFilter = "all" | "under-500" | "500-1000" | "over-1000";
const sortOptions = [{ value: "newest", label: "最新上架" }, { value: "popular", label: "熱門程度" }, { value: "price-asc", label: "價格低至高" }, { value: "price-desc", label: "價格高至低" }] as const;

const filters: Array<{ value: AvailabilityFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "in_stock", label: "現貨" },
  { value: "preorder", label: "預購" },
];

const priceRanges: Array<{ value: PriceFilter; label: string }> = [
  { value: "all", label: "全部價格" },
  { value: "under-500", label: "NT$500 以下" },
  { value: "500-1000", label: "NT$501–1,000" },
  { value: "over-1000", label: "NT$1,001 以上" },
];

export function ProductBrowser({ products, categories = [], initialQuery = "", initialCategory = "all", initialAvailability = "all", initialSort = "newest", initialPrice = "all" }: { products: Product[]; categories?: PublicCategory[]; initialQuery?: string; initialCategory?: CategoryFilter; initialAvailability?: AvailabilityFilter; initialSort?: SortFilter; initialPrice?: PriceFilter }) {
  const [query, setQuery] = useState(initialQuery.slice(0, 80));
  const [availability, setAvailability] = useState<AvailabilityFilter>(initialAvailability);
  const [category, setCategory] = useState<CategoryFilter>(initialCategory);
  const [sort, setSort] = useState<SortFilter>(initialSort);
  const [price, setPrice] = useState<PriceFilter>(initialPrice);
  const [page, setPage] = useState(1);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products
      .filter((product) => availability === "all"
        || (product.variants?.length
          ? product.variants.some((variant) => variant.availability === availability)
          : product.isAvailable && (product.availability === availability || product.availability === "mixed")))
      .filter((product) => category === "all" || product.category === category)
      .filter((product) => price === "all"
        || (price === "under-500" && product.price <= 500)
        || (price === "500-1000" && product.price > 500 && product.price <= 1000)
        || (price === "over-1000" && product.price > 1000))
      .filter((product) => !normalizedQuery || `${product.name} ${product.description}`.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (sort === "price-asc") return a.price - b.price;
        if (sort === "price-desc") return b.price - a.price;
        if (sort === "popular") return (b.soldQuantity ?? 0) - (a.soldQuantity ?? 0) || products.indexOf(a) - products.indexOf(b);
        return products.indexOf(a) - products.indexOf(b);
      });
  }, [availability, category, price, products, query, sort]);

  const hasFilters = Boolean(query.trim()) || availability !== "all" || category !== "all" || price !== "all";
  const catalogIsEmpty = products.length === 0;
  const pageSize = 12;
  const pagedProducts = visibleProducts.slice(0, page * pageSize);
  const categoryFilters = [{ slug: "all", name: "全部男裝" }, ...categories];

  // Keep the current catalogue view shareable without adding a browser-history
  // entry for every keystroke or filter click. The server page already reads
  // these same parameters on a fresh request, so refresh/back-to-page restores
  // the exact view while the client remains in control of filtering.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextValues: Array<[string, string, string]> = [
      ["q", query.trim(), ""],
      ["category", category, "all"],
      ["availability", availability, "all"],
      ["price", price, "all"],
      ["sort", sort, "newest"],
    ];
    nextValues.forEach(([key, value, defaultValue]) => {
      if (value && value !== defaultValue) params.set(key, value);
      else params.delete(key);
    });
    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(window.history.state, "", nextUrl);
  }, [availability, category, price, query, sort]);

  return <>
    <div className={styles.browser}>
      <label className={styles.search}>
        <span className={styles.srOnly}>搜尋商品</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input className="input" type="search" value={query} maxLength={80} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜尋商品" />
      </label>
      <div className={styles.toolbar}>
        <div className={styles.filterRows}>
          <div className={styles.filterGroup} role="group" aria-label="商品類別篩選">
            {categoryFilters.map((filter) => <button className={`${styles.filter} ${category === filter.slug ? styles.filterSelected : ""}`} type="button" key={filter.slug} aria-pressed={category === filter.slug} onClick={() => { setCategory(filter.slug); setPage(1); }}>{filter.name}</button>)}
          </div>
          <div className={styles.filterGroup} role="group" aria-label="商品狀態篩選">
          {filters.map((filter) => <button className={`${styles.filter} ${availability === filter.value ? styles.filterSelected : ""}`} type="button" key={filter.value} aria-pressed={availability === filter.value} onClick={() => { setAvailability(filter.value); setPage(1); }}>{filter.label}</button>)}
          </div>
          <div className={styles.filterGroup} role="group" aria-label="商品價格篩選">
            {priceRanges.map((filter) => <button className={`${styles.filter} ${price === filter.value ? styles.filterSelected : ""}`} type="button" key={filter.value} aria-pressed={price === filter.value} onClick={() => { setPrice(filter.value); setPage(1); }}>{filter.label}</button>)}
          </div>
        </div>
        <label className={styles.sort}>
          <span>排序</span>
          <RoundedSelect id="product-sort" options={sortOptions} value={sort} onValueChange={(value) => { setSort(value as SortFilter); setPage(1); }} ariaLabel="商品排序" />
        </label>
      </div>
    </div>
    <div className={styles.resultMeta} aria-live="polite">
      <span>{visibleProducts.length} 件商品</span>
      {hasFilters && <button type="button" onClick={() => { setQuery(""); setAvailability("all"); setCategory("all"); setPrice("all"); setPage(1); }}>清除條件</button>}
    </div>
    {visibleProducts.length > 0
      ? <><div className={styles.grid}>{pagedProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>{pagedProducts.length < visibleProducts.length && <div className={styles.loadMore}><button className="button button-secondary" type="button" onClick={() => setPage((current) => current + 1)}>載入更多</button><span>已顯示 {pagedProducts.length}／{visibleProducts.length} 件</span></div>}</>
      : <div className={styles.empty} role="status">
        <strong>{catalogIsEmpty ? "目前尚無可售商品" : "找不到符合條件的選品"}</strong>
        <p>{catalogIsEmpty ? "商品正在準備中，請稍後再回來看看。" : "換個關鍵字或清除篩選，再試一次。"}</p>
        <button className="button button-secondary" type="button" onClick={() => {
          if (catalogIsEmpty) {
            window.location.reload();
            return;
          }
          setQuery("");
          setAvailability("all");
          setCategory("all");
          setPrice("all");
          setPage(1);
        }}>{catalogIsEmpty ? "重新整理" : "清除條件"}</button>
      </div>}
  </>;
}
