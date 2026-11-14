import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { BRAND_ASSETS, DEFAULT_LOCALE, HTML_LANG, LOCALES, type Locale, PRODUCT } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.STUDIO_PUBLIC_ORIGIN ?? "http://localhost:3000"),
  title: PRODUCT.name,
  icons: {
    icon: [
      { url: BRAND_ASSETS.icon16, sizes: "16x16", type: "image/png" },
      { url: BRAND_ASSETS.icon32, sizes: "32x32", type: "image/png" },
      { url: BRAND_ASSETS.favicon },
    ],
    shortcut: BRAND_ASSETS.favicon,
    apple: BRAND_ASSETS.appleTouchIcon,
  },
  manifest: BRAND_ASSETS.manifest,
  openGraph: {
    title: PRODUCT.name,
    type: "website",
    images: [{ url: BRAND_ASSETS.icon512, width: 512, height: 512, alt: PRODUCT.name }],
  },
  twitter: { card: "summary", images: [BRAND_ASSETS.icon512] },
};

type RootLayoutProps = { children: ReactNode; params: Promise<{ locale?: string }> };

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale: requestedLocale } = await params;
  const locale = LOCALES.includes(requestedLocale as Locale) ? (requestedLocale as Locale) : DEFAULT_LOCALE;

  return (
    <html lang={HTML_LANG[locale]}>
      <body>{children}</body>
    </html>
  );
}
