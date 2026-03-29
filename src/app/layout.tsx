import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { LocaleProviderWrapper } from "@/components/LocaleProviderWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MeshiMatch",
  description: "みんなの好みに合うレストランを見つけよう",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} antialiased`}>
        <LocaleProviderWrapper>{children}</LocaleProviderWrapper>
      </body>
    </html>
  );
}
