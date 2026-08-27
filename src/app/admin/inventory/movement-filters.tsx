"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import adminStyles from "../admin.module.css";
import calendarStyles from "../reports/reports.module.css";
import { CalendarPicker } from "../reports/report-filters";

export function InventoryMovementFilters({ start, end, q }: { start: string; end: string; q: string }) {
  const [values, setValues] = useState({ start, end });
  const [active, setActive] = useState<"start" | "end" | null>(null);
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setActive(null);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  function setDate(name: "start" | "end", value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setActive(null);
  }

  return <form className={`${adminStyles.filters} ${adminStyles.inventoryMovementFilters}`} method="get" ref={containerRef}>
    <div className={calendarStyles.filterField}><label htmlFor="inventory-search">搜尋</label><input className="input" id="inventory-search" name="q" defaultValue={q} placeholder="商品、SKU、訂單或原因" maxLength={80} /></div>
    <div className={calendarStyles.filterField}><label htmlFor="inventory-start">開始日期</label><CalendarPicker label="開始日期" name="start" value={values.start} active={active === "start"} onOpen={() => setActive(active === "start" ? null : "start")} onChange={(value) => setDate("start", value)} /></div>
    <div className={calendarStyles.filterField}><label htmlFor="inventory-end">結束日期</label><CalendarPicker label="結束日期" name="end" value={values.end} active={active === "end"} onOpen={() => setActive(active === "end" ? null : "end")} onChange={(value) => setDate("end", value)} /></div>
    <button className="button button-secondary" type="submit">套用</button>{(values.start || values.end || q) && <Link className="button button-secondary" href="/admin/inventory">清除</Link>}
  </form>;
}
