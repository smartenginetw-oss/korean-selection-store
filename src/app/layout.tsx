import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/features/cart/cart-provider";

export const metadata: Metadata = {
  title: { default: "GYEOT｜韓國男裝", template: "%s｜GYEOT" },
  description: "陪你穿進日常的韓國男裝選品。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" data-scroll-behavior="smooth">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
