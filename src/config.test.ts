import { describe, expect, test } from "bun:test"
import { DEFAULT_CLIENT_ID, getConfig } from "./config"

describe("getConfig", () => {
  test("returns correct defaults when no options or env vars provided", () => {
    const config = getConfig()
    expect(config.enabled).toBe(true)
    expect(config.clientId).toBe(DEFAULT_CLIENT_ID)
    expect(config.language).toBe("en")
  })

  test("returns correct defaults when options are partially undefined", () => {
    const config = getConfig({})
    expect(config.enabled).toBe(true)
    expect(config.clientId).toBe(DEFAULT_CLIENT_ID)
    expect(config.language).toBe("en")
  })

  test("parses legacy enabled option from options object", () => {
    const config = getConfig({ enabled: false })
    expect(config.enabled).toBe(false)
  })

  test("parses legacy applicationId option from options object", () => {
    const config = getConfig({ applicationId: "1234567890" })
    expect(config.clientId).toBe("1234567890")
  })

  test("parses legacy language option from options object (en)", () => {
    const config = getConfig({ language: "en" })
    expect(config.language).toBe("en")
  })

  test("parses legacy language option from options object (ko)", () => {
    const config = getConfig({ language: "ko" })
    expect(config.language).toBe("ko")
  })

  test("parses legacy language option case-insensitively", () => {
    expect(getConfig({ language: "EN" }).language).toBe("en")
    expect(getConfig({ language: "KO" }).language).toBe("ko")
    expect(getConfig({ language: "KR" }).language).toBe("ko")
    expect(getConfig({ language: "korean" }).language).toBe("ko")
  })

  test("parses rich presence enableFileSpotlight option (default true)", () => {
    const config = getConfig({})
    expect(config.richPresence).toBeDefined()
    expect(config.richPresence.enableFileSpotlight).toBe(true)
  })

  test("parses rich presence enableMissionBoard option (default true)", () => {
    const config = getConfig({})
    expect(config.richPresence.enableMissionBoard).toBe(true)
  })

  test("accepts rich presence enableFileSpotlight as false", () => {
    const config = getConfig({ richPresence: { enableFileSpotlight: false } })
    expect(config.richPresence.enableFileSpotlight).toBe(false)
  })

  test("accepts rich presence enableMissionBoard as false", () => {
    const config = getConfig({ richPresence: { enableMissionBoard: false } })
    expect(config.richPresence.enableMissionBoard).toBe(false)
  })

  test("rotation interval defaults to 20", () => {
    const config = getConfig({})
    expect(config.richPresence.rotationIntervalSeconds).toBe(20)
  })

  test("rotation interval accepts value at lower boundary (10)", () => {
    const config = getConfig({ richPresence: { rotationIntervalSeconds: 10 } })
    expect(config.richPresence.rotationIntervalSeconds).toBe(10)
  })

  test("rotation interval accepts value at upper boundary (60)", () => {
    const config = getConfig({ richPresence: { rotationIntervalSeconds: 60 } })
    expect(config.richPresence.rotationIntervalSeconds).toBe(60)
  })

  test("rotation interval clamps negative values to minimum (10)", () => {
    const config = getConfig({ richPresence: { rotationIntervalSeconds: -5 } })
    expect(config.richPresence.rotationIntervalSeconds).toBe(10)
  })

  test("rotation interval clamps zero to minimum (10)", () => {
    const config = getConfig({ richPresence: { rotationIntervalSeconds: 0 } })
    expect(config.richPresence.rotationIntervalSeconds).toBe(10)
  })

  test("rotation interval clamps values below minimum to 10", () => {
    const config = getConfig({ richPresence: { rotationIntervalSeconds: 5 } })
    expect(config.richPresence.rotationIntervalSeconds).toBe(10)
  })

  test("rotation interval clamps values above maximum to 60", () => {
    const config = getConfig({
      richPresence: { rotationIntervalSeconds: 100 },
    })
    expect(config.richPresence.rotationIntervalSeconds).toBe(60)
  })

  test("rotation interval accepts floating point and clamps to integer", () => {
    const config = getConfig({
      richPresence: { rotationIntervalSeconds: 25.7 },
    })
    expect(config.richPresence.rotationIntervalSeconds).toBe(26)
  })

  test("ignores non-numeric rotation interval and falls back to default", () => {
    // @ts-expect-error - intentional invalid input at runtime
    const config = getConfig({
      richPresence: { rotationIntervalSeconds: "twenty" },
    })
    expect(config.richPresence.rotationIntervalSeconds).toBe(20)
  })

  test("richPresence diagnostics field exists with errorsOnly default true", () => {
    const config = getConfig({})
    expect(config.richPresence.diagnostics).toBeDefined()
    expect(config.richPresence.diagnostics.errorsOnly).toBe(true)
  })

  test("richPresence diagnostics errorsOnly can be set to false", () => {
    const config = getConfig({
      richPresence: { diagnostics: { errorsOnly: false } },
    })
    expect(config.richPresence.diagnostics.errorsOnly).toBe(false)
  })

  test("legacy options still work alongside new richPresence options", () => {
    const config = getConfig({
      enabled: false,
      applicationId: "custom-id",
      language: "ko",
      richPresence: {
        enableFileSpotlight: false,
        enableMissionBoard: false,
        rotationIntervalSeconds: 30,
      },
    })
    expect(config.enabled).toBe(false)
    expect(config.clientId).toBe("custom-id")
    expect(config.language).toBe("ko")
    expect(config.richPresence.enableFileSpotlight).toBe(false)
    expect(config.richPresence.enableMissionBoard).toBe(false)
    expect(config.richPresence.rotationIntervalSeconds).toBe(30)
  })

  test("undefined richPresence key defaults all rich options", () => {
    const config = getConfig({ richPresence: undefined })
    expect(config.richPresence.enableFileSpotlight).toBe(true)
    expect(config.richPresence.enableMissionBoard).toBe(true)
    expect(config.richPresence.rotationIntervalSeconds).toBe(20)
  })

  test("partial richPresence keys get safe defaults for omitted keys", () => {
    const config = getConfig({ richPresence: { enableFileSpotlight: false } })
    expect(config.richPresence.enableFileSpotlight).toBe(false)
    expect(config.richPresence.enableMissionBoard).toBe(true)
    expect(config.richPresence.rotationIntervalSeconds).toBe(20)
  })
})
