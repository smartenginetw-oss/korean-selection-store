import styles from "./product-visual.module.css";

export function ProductVisual({ palette, label, large = false }: { palette: [string, string]; label: string; large?: boolean }) {
  return <div className={`${styles.visual} ${large ? styles.large : ""}`} style={{ "--tone-a": palette[0], "--tone-b": palette[1] } as React.CSSProperties} role="img" aria-label={`${label} 商品示意圖`}>
    <span className={styles.shape} aria-hidden="true" />
    <span className={styles.word} aria-hidden="true">SEOUL SELECT</span>
  </div>;
}
