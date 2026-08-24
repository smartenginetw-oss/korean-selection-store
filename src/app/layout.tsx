import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/features/cart/cart-provider";
import { siteDescription, siteName, siteUrl } from "@/lib/site";

const isAdminApp = (process.env.NEXT_PUBLIC_APP_MODE ?? process.env.APP_MODE) === "admin";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "GYEOT｜韓國男裝", template: "%s｜GYEOT" },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    locale: "zh_TW",
    title: "GYEOT｜韓國男裝",
    description: siteDescription,
    url: siteUrl,
  },
  robots: isAdminApp ? { index: false, follow: false } : { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" data-scroll-behavior="smooth">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
