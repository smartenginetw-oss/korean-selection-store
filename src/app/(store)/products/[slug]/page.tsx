import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { getCatalog, getProductBySlug } from "@/features/catalog/server";
import { ProductGallery } from "@/features/catalog/product-gallery";
import { ProductPurchasePanel } from "@/features/catalog/product-purchase-panel";
import { FavoriteButton } from "@/components/favorite-button";
import { formatTwd } from "@/lib/money";
import { siteName, siteUrl } from "@/lib/site";
import styles from "./product.module.css";

export async function generateStaticParams() {
  const products = await getCatalog();
  return products.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "找不到商品" };

  const description = product.description || `${product.name}｜GYEOT 韓國男裝選品`;
  const images = product.images ?? [];
  const canonical = `${siteUrl}/products/${product.slug}`;
  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${product.name}｜${siteName}`,
      description,
      images: images[0] ? [{ url: images[0], alt: `${product.name} 商品照片` }] : undefined,
    },
  };
}

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function isSizeOption(name: string) {
  return ["尺寸", "尺碼", "size"].includes(name.trim().toLowerCase());
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const products = await getCatalog();
  const images = product.images ?? [];
  const canonical = `${siteUrl}/products/${product.slug}`;
  const sizeGroup = product.optionGroups?.find((group) => isSizeOption(group.name));
  const sizeValues = sizeGroup?.values.length ? sizeGroup.values : product.sizes;
  const hasProductDetails = [product.material, product.origin, product.careInstructions].some(Boolean);
  const availabilityLabel = !product.isAvailable ? "售罄" : product.availability === "mixed" ? "現貨＋預購" : product.availability === "preorder" ? "預購" : "現貨";
  const availabilityClass = !product.isAvailable ? "badge-sold" : product.availability === "mixed" ? "badge-mixed" : product.availability === "preorder" ? "badge-preorder" : "badge-stock";
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description,
      image: images.length ? images : undefined,
      brand: { "@type": "Brand", name: siteName },
      offers: {
        "@type": "Offer",
        url: canonical,
        priceCurrency: "TWD",
        price: product.price.toString(),
        availability: !product.isAvailable ? "https://schema.org/OutOfStock" : product.availability === "preorder" ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首頁", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "全部商品", item: `${siteUrl}/products` },
        { "@type": "ListItem", position: 3, name: product.name, item: canonical },
      ],
    },
  ];
  return <div className={`container ${styles.page}`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
    <div className={styles.main}>
      <ProductGallery palette={product.palette} images={product.images} label={product.name} />
      <div className={styles.info}><div className={styles.badges}>{product.badge && <span className="badge badge-new">{product.badge}</span>}<span className={`badge ${availabilityClass}`}>{availabilityLabel}</span></div><div className={styles.titleRow}><h1 className="serif">{product.name}</h1><FavoriteButton productId={product.id} returnTo={`/products/${product.slug}`} /></div><div className={styles.price}>{product.originalPrice && <del>{formatTwd(product.originalPrice)}</del>}<strong>{formatTwd(product.price)}</strong></div><p className={styles.description}>{product.description}</p><ProductPurchasePanel product={product} /><div className={styles.details}>
        <details open><summary>尺寸與版型</summary><div className={styles.fitPanel}><div className={styles.fitBlock}><span className={styles.detailEyebrow}>可選尺寸</span>{sizeValues.length ? <div className={styles.sizeChips}>{sizeValues.map((size) => <span key={size}>{size}</span>)}</div> : <p>尺寸規格尚未補齊，請以結帳時可選項目為準。</p>}</div>{product.sizeGuide ? <div className={styles.fitBlock}><span className={styles.detailEyebrow}>尺寸表</span><p className={styles.preLine}>{product.sizeGuide}</p></div> : <div className={styles.fitBlock}><span className={styles.detailEyebrow}>尺寸表</span><p>目前尚未提供平量尺寸，建議先參考商品描述與可選規格。</p></div>}{product.modelInfo ? <div className={styles.fitBlock}><span className={styles.detailEyebrow}>Model 穿著</span><p>{product.modelInfo}</p></div> : null}</div></details>
        <details><summary>材質與保養</summary>{hasProductDetails ? <dl className={styles.detailList}>{[["材質", product.material], ["產地", product.origin], ["洗滌方式", product.careInstructions]].map(([label, value]) => value ? <div key={label}><dt>{label}</dt><dd>{value}</dd></div> : null)}</dl> : <p>商品材質與保養資訊尚未補齊，請以商品包裝標示為準。</p>}</details>
        <details><summary>配送與預購</summary><p>目前提供台灣宅配、7-ELEVEN 與全家超商取貨。混合現貨與預購商品將於全數到齊後一次寄出，運費依結帳時選擇的配送方式計算。</p></details>
        <details><summary>退換貨說明</summary><p>請先查看商城的退換貨政策；正式營運前會由老闆完成法務審閱後發布。</p></details>
      </div></div>
    </div>
    <section className={styles.related}><div className="section-head"><h2 className="section-title serif">你可能也喜歡</h2></div><div className={styles.relatedGrid}>{products.filter(({ id }) => id !== product.id).slice(0, 3).map((item) => <ProductCard key={item.id} product={item} />)}</div></section>
  </div>;
}
