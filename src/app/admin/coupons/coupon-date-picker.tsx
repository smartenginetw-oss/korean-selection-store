"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFixedPopoverPosition } from "@/components/fixed-popover-position";
import calendarStyles from "../reports/reports.module.css";
import styles from "./coupons.module.css";

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

function todayInput() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function datePart(value: string) {
  return value.split("T")[0] ?? "";
}

function timePart(value: string) {
  return value.split("T")[1]?.slice(0, 5) || "00:00";
}

function formatValue(value: string) {
  if (!value) return "選擇日期與時間";
  const [date, time] = value.split("T");
  return `${date.replaceAll("-", "/")} ${time?.slice(0, 5) || "00:00"}`;
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

export function CouponDatePicker({ name, label }: { name: "startsAt" | "endsAt"; label: string }) {
  const [value, setValue] = useState("");
  const [active, setActive] = useState(false);
  const [viewMonth, setViewMonth] = useState(monthKey(todayInput()));
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cells = useMemo(() => daysForMonth(viewMonth), [viewMonth]);
  const selectedDate = datePart(value);
  const selectedTime = timePart(value);

  useEffect(() => {
    if (!active) return;
    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      setPosition(getFixedPopoverPosition(button, { width: 286, height: 390 }));
    }
    function closeOnOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setActive(false);
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

  function setDate(date: string) {
    setValue(`${date}T${selectedTime}`);
    setActive(false);
  }

  return <div className={calendarStyles.datePicker} ref={containerRef}>
    <button ref={buttonRef} className={calendarStyles.dateButton} id={`coupon-${name}`} type="button" aria-haspopup="dialog" aria-expanded={active} onClick={() => { if (!active) setViewMonth(monthKey(selectedDate || todayInput())); setActive(!active); }}>
      <span>{formatValue(value)}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
    </button>
    <input type="hidden" name={name} value={value} />
    {active && <div className={calendarStyles.calendar} style={{ top: position.top, left: position.left }} role="dialog" aria-label={`${label}日曆`}>
      <div className={calendarStyles.calendarHeader}><button type="button" aria-label="上一個月" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}>←</button><strong>{monthTitle(viewMonth)}</strong><button type="button" aria-label="下一個月" onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}>→</button></div>
      <div className={calendarStyles.weekdays}>{weekdayLabels.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
      <div className={calendarStyles.calendarGrid}>{cells.map((cell) => <button className={`${calendarStyles.day} ${cell.outside ? calendarStyles.dayOutside : ""} ${cell.date === selectedDate ? calendarStyles.daySelected : ""} ${cell.date === todayInput() ? calendarStyles.dayToday : ""}`} key={cell.date} type="button" aria-label={cell.date} aria-pressed={cell.date === selectedDate} onClick={() => setDate(cell.date)}>{cell.day}</button>)}</div>
      <div className={styles.timeRow}><span>時間</span><input type="time" value={selectedTime} onChange={(event) => setValue(selectedDate ? `${selectedDate}T${event.target.value}` : `${todayInput()}T${event.target.value}`)} /></div>
      <div className={styles.calendarActions}><button className={calendarStyles.todayButton} type="button" onClick={() => setDate(todayInput())}>今天</button><button className={calendarStyles.todayButton} type="button" onClick={() => { setValue(""); setActive(false); }}>清除</button></div>
    </div>}
  </div>;
}
