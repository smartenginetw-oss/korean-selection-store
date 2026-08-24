import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if ((process.env.NEXT_PUBLIC_APP_MODE ?? process.env.APP_MODE) === "admin") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/admin-login", "/account", "/cart", "/checkout", "/login", "/register", "/api/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
