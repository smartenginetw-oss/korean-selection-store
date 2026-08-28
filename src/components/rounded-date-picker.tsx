"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFixedPopoverPosition } from "@/components/fixed-popover-position";
import styles from "@/app/admin/reports/reports.module.css";

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

function monthKey(value: string) {
  return value.slice(0, 7);
}

function dateToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthTitle(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}年${month}月`;
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
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

function formatDate(value: string) {
  return value ? value.replaceAll("-", "/") : "選擇日期";
}

export function RoundedDatePicker({ name, label, initialValue, required = false }: { name: string; label: string; initialValue?: string; required?: boolean }) {
  const fallback = initialValue || dateToday();
  const [value, setValue] = useState(initialValue ?? "");
  const [viewMonth, setViewMonth] = useState(monthKey(fallback));
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cells = useMemo(() => daysForMonth(viewMonth), [viewMonth]);

  useEffect(() => {
    if (!active) return;
    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      setPosition(getFixedPopoverPosition(button, { width: 286, height: 300 }));
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

  function choose(date: string) {
    setValue(date);
    setActive(false);
  }

  return <div className={styles.datePicker} ref={wrapperRef}>
    <button ref={buttonRef} className={styles.dateButton} id={name} type="button" aria-haspopup="dialog" aria-expanded={active} aria-label={label} onClick={() => { if (!active) setViewMonth(monthKey(value || fallback)); setActive((current) => !current); }}>
      <span>{formatDate(value)}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
    </button>
    <input type="hidden" name={name} value={value} required={required} />
    {active && <div className={styles.calendar} style={{ top: position.top, left: position.left }} role="dialog" aria-label={`${label}日曆`}>
      <div className={styles.calendarHeader}>
        <button type="button" aria-label="上一個月" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}>←</button>
        <strong>{monthTitle(viewMonth)}</strong>
        <button type="button" aria-label="下一個月" onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}>→</button>
      </div>
      <div className={styles.weekdays}>{weekdayLabels.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
      <div className={styles.calendarGrid}>{cells.map((cell) => <button className={`${styles.day} ${cell.outside ? styles.dayOutside : ""} ${cell.date === value ? styles.daySelected : ""} ${cell.date === dateToday() ? styles.dayToday : ""}`} key={cell.date} type="button" aria-label={cell.date} aria-pressed={cell.date === value} onClick={() => choose(cell.date)}>{cell.day}</button>)}</div>
      <button className={styles.todayButton} type="button" onClick={() => choose(dateToday())}>今天</button>
    </div>}
  </div>;
}
