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

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const products = await getCatalog();
  const images = product.images ?? [];
  const canonical = `${siteUrl}/products/${product.slug}`;
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
        availability: product.availability === "preorder" ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
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
      <div className={styles.info}><div className={styles.badges}>{product.badge && <span className="badge badge-new">{product.badge}</span>}<span className={`badge ${product.availability === "preorder" ? "badge-preorder" : "badge-stock"}`}>{product.availability === "preorder" ? "預購" : "現貨"}</span></div><div className={styles.titleRow}><h1 className="serif">{product.name}</h1><FavoriteButton productId={product.id} returnTo={`/products/${product.slug}`} /></div><div className={styles.price}>{product.originalPrice && <del>{formatTwd(product.originalPrice)}</del>}<strong>{formatTwd(product.price)}</strong></div><p className={styles.description}>{product.description}</p><ProductPurchasePanel product={product} /><div className={styles.details}><details open><summary>商品資訊</summary><p>柔軟親膚材質，版型以韓國選品原始尺寸為準。正式資料將由 Admin 商品欄位提供。</p></details><details><summary>配送與預購</summary><p>V1 僅提供台灣宅配。混合現貨與預購商品將於全數到齊後一次寄出。</p></details><details><summary>退換貨說明</summary><p>正式營運前將補入經法務確認的完整政策。</p></details></div></div>
    </div>
    <section className={styles.related}><div className="section-head"><h2 className="section-title serif">你可能也喜歡</h2></div><div className={styles.relatedGrid}>{products.filter(({ id }) => id !== product.id).slice(0, 3).map((item) => <ProductCard key={item.id} product={item} />)}</div></section>
  </div>;
}
