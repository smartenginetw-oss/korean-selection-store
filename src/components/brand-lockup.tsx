import Link from "next/link";
import styles from "./brand-lockup.module.css";

type BrandLockupProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function BrandContent() {
  return <>
    <span className={styles.mark} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 51V23a15 15 0 0 1 30 0v28" />
        <path d="M25 51V31a10 10 0 0 1 20 0v20" />
        <path d="M10 55h35" />
      </svg>
    </span>
    <span className={styles.wordmark}>
      <span className={styles.name}>GYEOT</span>
      <span className={styles.korean}>곁</span>
    </span>
  </>;
}

export function BrandLockup({ href, size = "md", className = "" }: BrandLockupProps) {
  const classNames = `${styles.lockup} ${styles[size]} ${className}`.trim();
  const label = "GYEOT 곁";
  return href
    ? <Link className={classNames} href={href} aria-label={label}><BrandContent /></Link>
    : <div className={classNames} aria-label={label}><BrandContent /></div>;
}
