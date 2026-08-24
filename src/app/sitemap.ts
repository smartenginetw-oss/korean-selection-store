import type { MetadataRoute } from "next";

import { getCatalog } from "@/features/catalog/server";
import { siteUrl } from "@/lib/site";

const publicPages = ["", "/products", "/about", "/shopping-guide", "/shipping", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getCatalog();
  return [
    ...publicPages.map((path) => ({ url: `${siteUrl}${path}`, changeFrequency: path === "" ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : 0.7 })),
    ...products.map((product) => ({ url: `${siteUrl}/products/${product.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
