import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { DEFAULT_CLIENT_ID, getConfig } from "./config"

const ENV_KEYS = [
  "OPENCODE_DISCORD_ENABLED",
  "OPENCODE_DISCORD_CLIENT_ID",
  "OPENCODE_DISCORD_LANGUAGE",
  "OPENCODE_DISCORD_DEBUG",
] as const

describe("getConfig precedence", () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  test("defaults: enabled=true, default clientId, language=en, debug=false", () => {
    expect(getConfig()).toEqual({
      enabled: true,
      clientId: DEFAULT_CLIENT_ID,
      language: "en",
      debug: false,
    })
  })

  test("file options override defaults", () => {
    expect(
      getConfig({ enabled: false, applicationId: "999", language: "ko", debug: true }),
    ).toEqual({
      enabled: false,
      clientId: "999",
      language: "ko",
      debug: true,
    })
  })

  test("env vars used when file options absent", () => {
    process.env.OPENCODE_DISCORD_ENABLED = "false"
    process.env.OPENCODE_DISCORD_CLIENT_ID = "111"
    process.env.OPENCODE_DISCORD_LANGUAGE = "ko"
    process.env.OPENCODE_DISCORD_DEBUG = "true"
    expect(getConfig()).toEqual({
      enabled: false,
      clientId: "111",
      language: "ko",
      debug: true,
    })
  })

  test("file option wins over env", () => {
    process.env.OPENCODE_DISCORD_CLIENT_ID = "envID"
    process.env.OPENCODE_DISCORD_LANGUAGE = "en"
    process.env.OPENCODE_DISCORD_DEBUG = "true"
    expect(getConfig({ applicationId: "fileID", language: "ko", debug: false })).toEqual({
      enabled: true,
      clientId: "fileID",
      language: "ko",
      debug: false,
    })
  })

  test("language normalization: 'kr' / 'korean' / 'KO' → 'ko'", () => {
    expect(getConfig({ language: "kr" }).language).toBe("ko")
    expect(getConfig({ language: "korean" }).language).toBe("ko")
    expect(getConfig({ language: "KO" }).language).toBe("ko")
  })

  test("unknown language falls back to 'en'", () => {
    expect(getConfig({ language: "fr" }).language).toBe("en")
    expect(getConfig({ language: "" }).language).toBe("en")
  })

  test("enabled defaults to true when env var is not 'false'", () => {
    process.env.OPENCODE_DISCORD_ENABLED = "yes"
    expect(getConfig().enabled).toBe(true)
    process.env.OPENCODE_DISCORD_ENABLED = "false"
    expect(getConfig().enabled).toBe(false)
  })

  test("debug parses env var: true/1/yes → true; false/0/no → false; default false", () => {
    expect(getConfig().debug).toBe(false)
    for (const v of ["true", "TRUE", "1", "yes"]) {
      process.env.OPENCODE_DISCORD_DEBUG = v
      expect(getConfig().debug).toBe(true)
    }
    for (const v of ["false", "0", "no"]) {
      process.env.OPENCODE_DISCORD_DEBUG = v
      expect(getConfig().debug).toBe(false)
    }
    process.env.OPENCODE_DISCORD_DEBUG = "garbage"
    expect(getConfig().debug).toBe(false)
  })

  test("debug: option always wins over env", () => {
    process.env.OPENCODE_DISCORD_DEBUG = "false"
    expect(getConfig({ debug: true }).debug).toBe(true)
    process.env.OPENCODE_DISCORD_DEBUG = "true"
    expect(getConfig({ debug: false }).debug).toBe(false)
  })
})
