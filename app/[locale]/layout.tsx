import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { LOCALES, PRODUCT, type Locale } from "@/lib/constants";

type LocaleLayoutProps = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) notFound();
  const t = await getTranslations({ locale: locale as Locale, namespace: "auth" });
  const description = t("description");

  return {
    title: PRODUCT.name,
    description,
    openGraph: { title: PRODUCT.name, description },
    twitter: { title: PRODUCT.name, description },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) notFound();
  setRequestLocale(locale as Locale);
  const messages = await getMessages();

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
