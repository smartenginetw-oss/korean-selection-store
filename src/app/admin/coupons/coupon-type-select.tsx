"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./coupons.module.css";

const options = [
  { value: "percent", label: "百分比折扣" },
  { value: "fixed", label: "固定金額（TWD）" },
] as const;

export function CouponTypeSelect({ name, defaultValue = "percent" }: { name: string; defaultValue?: "percent" | "fixed" }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  function choose(nextValue: (typeof options)[number]["value"]) {
    setValue(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setValue(event.key === "ArrowDown" ? "percent" : "fixed");
    }
    if (event.key === "Escape") setOpen(false);
  }

  return <div className={styles.selectWrap} ref={containerRef}>
    <input type="hidden" name={name} value={value} />
    <button ref={triggerRef} className={styles.selectTrigger} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={handleTriggerKeyDown}>
      <span>{selected.label}</span><span className={`${styles.selectChevron} ${open ? styles.selectChevronOpen : ""}`} aria-hidden="true">⌄</span>
    </button>
    {open && <div className={styles.selectMenu} role="listbox" aria-label="折扣類型選擇">
      {options.map((option) => <button key={option.value} className={`${styles.selectOption} ${option.value === value ? styles.selectOptionSelected : ""}`} type="button" role="option" aria-selected={option.value === value} onClick={() => choose(option.value)}>{option.label}</button>)}
    </div>}
  </div>;
}
