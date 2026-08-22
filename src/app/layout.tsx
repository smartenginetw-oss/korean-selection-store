import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/features/cart/cart-provider";

export const metadata: Metadata = {
  title: { default: "MORII 韓國選品", template: "%s｜MORII" },
  description: "把韓國日常裡的溫柔質感，選進你的生活。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" data-scroll-behavior="smooth">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
