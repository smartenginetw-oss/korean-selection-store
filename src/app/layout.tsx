import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { CartProvider } from "@/features/cart/cart-provider";
import { siteDescription, siteName, siteUrl } from "@/lib/site";

const isAdminApp = (process.env.NEXT_PUBLIC_APP_MODE ?? process.env.APP_MODE) === "admin";
const configuredGaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
const gaMeasurementId = !isAdminApp && configuredGaMeasurementId && /^G-[A-Z0-9]+$/i.test(configuredGaMeasurementId)
  ? configuredGaMeasurementId
  : null;

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
      <body>
        {gaMeasurementId && <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
          <Script id="gyeot-ga4" strategy="afterInteractive">{`window.dataLayer = window.dataLayer || []; window.gtag = function(){window.dataLayer.push(arguments);}; window.gtag('js', new Date()); window.gtag('config', '${gaMeasurementId}', { anonymize_ip: true });`}</Script>
        </>}
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
