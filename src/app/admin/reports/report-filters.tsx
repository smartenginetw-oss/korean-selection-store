"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RoundedSelect } from "@/components/rounded-select";
import { getFixedPopoverPosition } from "@/components/fixed-popover-position";
import styles from "./reports.module.css";

type PickerName = "start" | "end";

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

function todayInput() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function currentMonthInput() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function formatDate(value: string) {
  return value ? value.replaceAll("-", "/") : "選擇日期";
}

function monthTitle(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}年${month}月`;
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}

const monthLabels = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
const cashflowOptions = [{ value: "income", label: "收入" }, { value: "expense", label: "支出" }, { value: "net", label: "淨收支" }] as const;
const granularityOptions = [{ value: "day", label: "每日" }, { value: "month", label: "每月" }, { value: "year", label: "每年" }] as const;

function formatMonth(value: string) {
  const [year, month] = value.split("-");
  return year && month ? `${year}年${month}月` : "選擇月份";
}

export function MonthPicker({ name, value }: { name: string; value: string }) {
  const [selectedMonth, setSelectedMonth] = useState(value);
  const [viewYear, setViewYear] = useState(Number(value.slice(0, 4)) || Number(currentMonthInput().slice(0, 4)));
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!active) return;
    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      setPosition(getFixedPopoverPosition(button, { width: 286, height: 230 }));
    }
    function closeOnOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setActive(false);
    }
    updatePosition();
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [active]);

  function chooseMonth(month: number) {
    const next = `${viewYear}-${String(month + 1).padStart(2, "0")}`;
    setSelectedMonth(next);
    setActive(false);
  }

  return <div className={styles.datePicker} ref={wrapperRef}>
    <button ref={buttonRef} className={styles.dateButton} id="report-expense-month" type="button" aria-haspopup="dialog" aria-expanded={active} onClick={() => { if (!active) setViewYear(Number(selectedMonth.slice(0, 4)) || Number(currentMonthInput().slice(0, 4))); setActive((current) => !current); }}>
      <span>{formatMonth(selectedMonth)}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
    </button>
    <input type="hidden" name={name} value={selectedMonth} />
    {active && <div className={`${styles.calendar} ${styles.monthCalendar}`} style={{ top: position.top, left: position.left }} role="dialog" aria-label="月份選擇器">
      <div className={styles.calendarHeader}>
        <button type="button" aria-label="上一年" onClick={() => setViewYear((year) => year - 1)}>←</button>
        <strong>{viewYear} 年</strong>
        <button type="button" aria-label="下一年" onClick={() => setViewYear((year) => year + 1)}>→</button>
      </div>
      <div className={styles.monthGrid}>
        {monthLabels.map((label, index) => <button className={`${styles.monthButton} ${selectedMonth === `${viewYear}-${String(index + 1).padStart(2, "0")}` ? styles.monthSelected : ""}`} key={label} type="button" aria-pressed={selectedMonth === `${viewYear}-${String(index + 1).padStart(2, "0")}`} onClick={() => chooseMonth(index)}>{label}</button>)}
      </div>
      <button className={styles.todayButton} type="button" onClick={() => { setSelectedMonth(currentMonthInput()); setActive(false); }}>本月</button>
    </div>}
  </div>;
}

function daysForMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const cells: Array<{ date: string; day: number; outside: boolean }> = [];
  for (let index = 0; index < 42; index += 1) {
    const offset = index - firstDay.getUTCDay();
    const date = new Date(Date.UTC(year, month - 1, 1 + offset));
    cells.push({ date: date.toISOString().slice(0, 10), day: date.getUTCDate(), outside: date.getUTCMonth() !== month - 1 });
  }
  return cells;
}

export function CalendarPicker({ label, name, value, active, onOpen, onChange }: { label: string; name: PickerName; value: string; active: boolean; onOpen: () => void; onChange: (value: string) => void }) {
  const initialMonth = monthKey(value || todayInput());
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cells = useMemo(() => daysForMonth(viewMonth), [viewMonth]);

  useEffect(() => {
    if (!active) return;
    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      setPosition(getFixedPopoverPosition(button, { width: 286, height: 300 }));
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [active]);

  return <div className={styles.datePicker}>
    <button ref={buttonRef} className={styles.dateButton} id={`report-${name}`} type="button" aria-haspopup="dialog" aria-expanded={active} onClick={() => { if (!active) setViewMonth(monthKey(value || todayInput())); onOpen(); }}>
      <span>{formatDate(value)}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
    </button>
    <input type="hidden" name={name} value={value} />
    {active && <div className={styles.calendar} style={{ top: position.top, left: position.left }} role="dialog" aria-label={`${label}日曆`}>
      <div className={styles.calendarHeader}>
        <button type="button" aria-label="上一個月" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}>←</button>
        <strong>{monthTitle(viewMonth)}</strong>
        <button type="button" aria-label="下一個月" onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}>→</button>
      </div>
      <div className={styles.weekdays}>{weekdayLabels.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
      <div className={styles.calendarGrid}>
        {cells.map((cell) => <button className={`${styles.day} ${cell.outside ? styles.dayOutside : ""} ${cell.date === value ? styles.daySelected : ""} ${cell.date === todayInput() ? styles.dayToday : ""}`} key={cell.date} type="button" aria-label={cell.date} aria-pressed={cell.date === value} onClick={() => onChange(cell.date)}>{cell.day}</button>)}
      </div>
      <button className={styles.todayButton} type="button" onClick={() => onChange(todayInput())}>今天</button>
    </div>}
  </div>;
}

export function ReportFilters({ startDate, endDate, granularity, cashflow }: { startDate: string; endDate: string; granularity: "day" | "month" | "year"; cashflow: "income" | "expense" | "net" }) {
  const [values, setValues] = useState({ start: startDate, end: endDate });
  const [active, setActive] = useState<PickerName | null>(null);
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setActive(null);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  function setDate(name: PickerName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setActive(null);
  }

  return <form className={styles.filters} method="get" ref={containerRef}>
    <div className={styles.filterField}><label htmlFor="report-start">起始日期</label><CalendarPicker label="起始日期" name="start" value={values.start} active={active === "start"} onOpen={() => setActive(active === "start" ? null : "start")} onChange={(value) => setDate("start", value)} /></div>
    <div className={styles.filterField}><label htmlFor="report-end">結束日期</label><CalendarPicker label="結束日期" name="end" value={values.end} active={active === "end"} onOpen={() => setActive(active === "end" ? null : "end")} onChange={(value) => setDate("end", value)} /></div>
    <div className={styles.filterField}><label htmlFor="report-cashflow">統計收支</label><RoundedSelect id="report-cashflow" name="cashflow" options={cashflowOptions} defaultValue={cashflow} ariaLabel="統計收支" /></div>
    <div className={styles.filterField}><label htmlFor="report-granularity">統計期間</label><RoundedSelect id="report-granularity" name="granularity" options={granularityOptions} defaultValue={granularity} ariaLabel="統計期間" /></div>
    <button className="button button-primary button-small" type="submit">更新報表</button><span className={styles.filterHint}>最多查詢 10 年</span>
  </form>;
}
