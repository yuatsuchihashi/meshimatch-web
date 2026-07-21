import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProviderWrapper } from "@/components/LocaleProviderWrapper";

export const metadata: Metadata = {
  title: "MeshiMatch",
  description: "みんなの「どこ食べる？」を○×で決めるアプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MeshiMatch",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#7EC84B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;800;900&family=Zen+Maru+Gothic:wght@400;500;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <LocaleProviderWrapper>{children}</LocaleProviderWrapper>
      </body>
    </html>
  );
}
