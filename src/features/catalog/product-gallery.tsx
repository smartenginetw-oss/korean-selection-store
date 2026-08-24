"use client";

import Image from "next/image";
import { useState } from "react";

import { ProductVisual } from "@/components/product-visual";
import styles from "./product-gallery.module.css";

export function ProductGallery({
  palette,
  label,
  images = [],
}: {
  palette: [string, string];
  label: string;
  images?: string[];
}) {
  const availableImages = images.filter(Boolean);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = availableImages[Math.min(activeIndex, Math.max(availableImages.length - 1, 0))];

  return <div className={styles.gallery}>
    <ProductVisual large palette={palette} images={activeImage ? [activeImage] : []} label={label} />
    {availableImages.length > 1 && <div className={styles.thumbs} aria-label="商品圖片選擇">
      {availableImages.map((image, index) => <button
        className={`${styles.thumb} ${index === activeIndex ? styles.active : ""}`}
        type="button"
        key={image}
        aria-label={`查看第 ${index + 1} 張商品圖片`}
        aria-pressed={index === activeIndex}
        onClick={() => setActiveIndex(index)}
      >
        <Image src={image} alt={`${label} 商品圖片 ${index + 1}`} fill sizes="96px" unoptimized />
      </button>)}
    </div>}
  </div>;
}
