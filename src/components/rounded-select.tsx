"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./rounded-select.module.css";

export type RoundedSelectOption = { value: string; label: string };

type RoundedSelectProps = {
  options: readonly RoundedSelectOption[];
  name?: string;
  id?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export function RoundedSelect({ options, name, id, defaultValue, value, onValueChange, disabled = false, ariaLabel }: RoundedSelectProps) {
  const generatedId = useId();
  const triggerId = id ?? `rounded-select-${generatedId}`;
  const menuId = `${triggerId}-menu`;
  const initialValue = defaultValue ?? options[0]?.value ?? "";
  const [internalValue, setInternalValue] = useState(initialValue);
  const selectedValue = value ?? internalValue;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === selectedValue)));
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.find((option) => option.value === selectedValue) ?? options[0];
  const activeOption = options[activeIndex];

  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuHeight = Math.min(280, options.length * 43 + 12);
      const margin = 12;
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin));
      const below = rect.bottom + 8;
      const top = below + menuHeight <= window.innerHeight - margin ? below : Math.max(margin, rect.top - menuHeight - 8);
      setMenuPosition({ top, left, width: rect.width });
    }
    function closeOnOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
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
  }, [open, options.length]);

  function choose(nextValue: string) {
    setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function toggle() {
    if (disabled) return;
    setOpen((current) => {
      const next = !current;
      if (next) {
        const selectedIndex = options.findIndex((option) => option.value === selectedValue);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return next;
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) toggle();
      else choose(options[activeIndex]?.value ?? selectedValue);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!options.length) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + options.length) % options.length);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : Math.max(0, options.length - 1));
    }
  }

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  return <div className={styles.wrap} ref={wrapperRef}>
    {name && <input type="hidden" name={name} value={selectedValue} />}
    <button ref={triggerRef} className={styles.trigger} id={triggerId} type="button" disabled={disabled} role="combobox" aria-haspopup="listbox" aria-controls={menuId} aria-expanded={open} aria-activedescendant={open && activeOption ? `${menuId}-option-${activeIndex}` : undefined} aria-label={ariaLabel} onClick={toggle} onKeyDown={handleKeyDown}>
      <span>{selected?.label ?? "請選擇"}</span><span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">⌄</span>
    </button>
    {open && <div className={styles.menu} id={menuId} role="listbox" aria-label={ariaLabel} style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}>
      {options.map((option, index) => <button ref={(element) => { optionRefs.current[index] = element; }} id={`${menuId}-option-${index}`} key={option.value} className={`${styles.option} ${option.value === selectedValue ? styles.optionSelected : ""} ${index === activeIndex ? styles.optionActive : ""}`} type="button" role="option" aria-selected={option.value === selectedValue} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option.value)}>{option.label}</button>)}
    </div>}
  </div>;
}
