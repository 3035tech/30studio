import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/constants";

const messageLoaders = {
  pt: () => import("@/messages/pt.json").then((module) => module.default),
  en: () => import("@/messages/en.json").then((module) => module.default),
} satisfies Record<Locale, () => Promise<Record<string, unknown>>>;

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale: Locale = LOCALES.includes(requestedLocale as Locale)
    ? (requestedLocale as Locale)
    : DEFAULT_LOCALE;

  return { locale, messages: await messageLoaders[locale]() };
});
