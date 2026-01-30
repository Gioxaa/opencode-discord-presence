import { describe, expect, test } from "bun:test"
import { getAvailableLanguages, getLocale, supportedLanguages } from "./index"

describe("i18n", () => {
  describe("supportedLanguages", () => {
    test("includes ko, en, ja, zh", () => {
      expect(supportedLanguages).toContain("ko")
      expect(supportedLanguages).toContain("en")
      expect(supportedLanguages).toContain("ja")
      expect(supportedLanguages).toContain("zh")
    })
  })

  describe("getLocale", () => {
    test("returns Korean locale for 'ko'", () => {
      const locale = getLocale("ko")
      expect(locale.code).toBe("ko")
      expect(locale.name).toBe("한국어")
    })

    test("returns English locale for 'en'", () => {
      const locale = getLocale("en")
      expect(locale.code).toBe("en")
      expect(locale.name).toBe("English")
    })

    test("returns Japanese locale for 'ja'", () => {
      const locale = getLocale("ja")
      expect(locale.code).toBe("ja")
      expect(locale.name).toBe("日本語")
    })

    test("returns Chinese locale for 'zh'", () => {
      const locale = getLocale("zh")
      expect(locale.code).toBe("zh")
      expect(locale.name).toBe("中文")
    })

    test("returns a locale for 'auto'", () => {
      const locale = getLocale("auto")
      expect(locale).toBeDefined()
      expect(supportedLanguages).toContain(locale.code)
    })
  })

  describe("locale.presence", () => {
    test("Korean active message uses particles", () => {
      const locale = getLocale("ko")
      expect(locale.presence.active("Prometheus")).toBe("Prometheus를 갈구는중")
      expect(locale.presence.active("Sisyphus")).toBe("Sisyphus를 갈구는중")
    })

    test("Korean idle message uses particles", () => {
      const locale = getLocale("ko")
      expect(locale.presence.idle("Prometheus")).toBe("Prometheus는 휴식중")
      expect(locale.presence.idle("Sisyphus")).toBe("Sisyphus는 휴식중")
    })

    test("English active message", () => {
      const locale = getLocale("en")
      expect(locale.presence.active("Prometheus")).toBe("Working with Prometheus")
    })

    test("English idle message", () => {
      const locale = getLocale("en")
      expect(locale.presence.idle("Prometheus")).toBe("Prometheus is idle")
    })

    test("Japanese active message", () => {
      const locale = getLocale("ja")
      expect(locale.presence.active("Prometheus")).toBe("Prometheusで作業中")
    })

    test("Chinese active message", () => {
      const locale = getLocale("zh")
      expect(locale.presence.active("Prometheus")).toBe("正在使用 Prometheus")
    })
  })

  describe("getAvailableLanguages", () => {
    test("returns array of language objects", () => {
      const languages = getAvailableLanguages()
      expect(languages.length).toBeGreaterThanOrEqual(4)
      expect(languages.some((l) => l.code === "ko")).toBe(true)
      expect(languages.some((l) => l.code === "en")).toBe(true)
    })

    test("each language has code and name", () => {
      const languages = getAvailableLanguages()
      for (const lang of languages) {
        expect(typeof lang.code).toBe("string")
        expect(typeof lang.name).toBe("string")
      }
    })
  })
})
