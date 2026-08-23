import Image from "next/image";

import styles from "./product-visual.module.css";

export function ProductVisual({ palette, label, images = [], large = false }: { palette: [string, string]; label: string; images?: string[]; large?: boolean }) {
  if (images[0]) {
    return <div className={styles.visual + " " + (large ? styles.large : "")} role="img" aria-label={label + " 商品圖片"}>
      <Image className={styles.image} src={images[0]} alt={label + " 商品圖片"} fill sizes={large ? "(min-width: 850px) 55vw, 100vw" : "(min-width: 850px) 30vw, 50vw"} unoptimized />
    </div>;
  }

  return <div className={`${styles.visual} ${large ? styles.large : ""}`} style={{ "--tone-a": palette[0], "--tone-b": palette[1] } as React.CSSProperties} role="img" aria-label={`${label} 商品示意圖`}>
    <span className={styles.shape} aria-hidden="true" />
    <span className={styles.word} aria-hidden="true">SEOUL SELECT</span>
  </div>;
}
