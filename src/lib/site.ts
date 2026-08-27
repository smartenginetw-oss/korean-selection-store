export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://korean-selection-store-rebuilt.vercel.app").replace(/\/+$/, "");
export const adminSiteUrl = (process.env.NEXT_PUBLIC_ADMIN_SITE_URL ?? "https://gyeot-admin.vercel.app").replace(/\/+$/, "");
export const siteName = "GYEOT";
export const siteDescription = "陪你穿進日常的韓國男裝選品。";

/**
 * Use stable Vercel aliases for auth links instead of an ephemeral deployment
 * URL. Local development intentionally keeps the current origin.
 */
export function getCanonicalAuthOrigin(audience: "member" | "admin") {
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
    return window.location.origin;
  }
  return audience === "admin" ? adminSiteUrl : siteUrl;
}
