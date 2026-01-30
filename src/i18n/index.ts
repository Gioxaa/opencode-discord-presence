import { en } from "./locales/en"
import { ja } from "./locales/ja"
import { ko, type Locale } from "./locales/ko"
import { zh } from "./locales/zh"

export type SupportedLanguage = "ko" | "en" | "ja" | "zh" | "auto"

const locales: Record<Exclude<SupportedLanguage, "auto">, Locale> = {
  ko,
  en,
  ja,
  zh,
}

export const supportedLanguages = Object.keys(locales) as Exclude<SupportedLanguage, "auto">[]

function detectSystemLanguage(): Exclude<SupportedLanguage, "auto"> {
  const env = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || ""
  const langCode = env.split("_")[0]?.toLowerCase()

  if (langCode && langCode in locales) {
    return langCode as Exclude<SupportedLanguage, "auto">
  }

  return "en"
}

export function getLocale(language: SupportedLanguage = "auto"): Locale {
  if (language === "auto") {
    return locales[detectSystemLanguage()]
  }

  return locales[language] || locales.en
}

export function getAvailableLanguages(): Array<{ code: string; name: string }> {
  return Object.values(locales).map((locale) => ({
    code: locale.code,
    name: locale.name,
  }))
}

export type { Locale } from "./locales/ko"
