/**
 * @fileoverview Tests for configuration management
 */

import { describe, expect, test } from "bun:test"
import { DEFAULT_APPLICATION_ID, defaultConfig, getConfig, validateConfig } from "./config"

describe("defaultConfig", () => {
  test("has expected default values", () => {
    expect(defaultConfig.enabled).toBe(true)
    expect(defaultConfig.showSessionTime).toBe(true)
    expect(defaultConfig.showTokenUsage).toBe(true)
    expect(defaultConfig.showProjectName).toBe(true)
    expect(defaultConfig.applicationId).toBe(DEFAULT_APPLICATION_ID)
  })
})

describe("getConfig", () => {
  test("returns default config when empty object provided", () => {
    const config = getConfig({})
    expect(config.enabled).toBe(true)
    expect(config.showSessionTime).toBe(true)
    expect(config.showTokenUsage).toBe(true)
    expect(config.showProjectName).toBe(true)
  })

  test("merges user config with defaults", () => {
    const config = getConfig({ showTokenUsage: false })
    expect(config.showTokenUsage).toBe(false)
    expect(config.showSessionTime).toBe(true) // default
    expect(config.enabled).toBe(true) // default
  })

  test("allows overriding all options", () => {
    const config = getConfig({
      enabled: false,
      applicationId: "custom-id",
      showSessionTime: false,
      showTokenUsage: false,
      showProjectName: false,
    })
    expect(config.enabled).toBe(false)
    expect(config.applicationId).toBe("custom-id")
    expect(config.showSessionTime).toBe(false)
    expect(config.showTokenUsage).toBe(false)
    expect(config.showProjectName).toBe(false)
  })
})

describe("validateConfig", () => {
  test("warns about default application ID", () => {
    const warnings = validateConfig(defaultConfig)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.some((w) => w.includes("default Discord Application ID"))).toBe(true)
  })

  test("warns about missing application ID", () => {
    const config = getConfig({ applicationId: "" })
    const warnings = validateConfig(config)
    expect(warnings.some((w) => w.includes("Application ID is required"))).toBe(true)
  })

  test("no warnings with custom application ID", () => {
    const config = getConfig({ applicationId: "1234567890123456789" })
    const warnings = validateConfig(config)
    expect(warnings.length).toBe(0)
  })
})
