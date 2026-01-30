/**
 * @fileoverview Tests for format utilities
 */

import { describe, expect, test } from "bun:test"
import { formatModelName, formatTokens } from "./format"

describe("formatTokens", () => {
  test("formats zero tokens", () => {
    expect(formatTokens({ input: 0, output: 0 })).toBe("0 tokens")
  })

  test("formats small numbers without k suffix", () => {
    expect(formatTokens({ input: 500, output: 200 })).toBe("700 tokens")
    expect(formatTokens({ input: 100, output: 50 })).toBe("150 tokens")
  })

  test("formats thousands with k suffix", () => {
    expect(formatTokens({ input: 8200, output: 4300 })).toBe("12.5k tokens")
    expect(formatTokens({ input: 5000, output: 5000 })).toBe("10k tokens")
  })

  test("rounds to one decimal place", () => {
    expect(formatTokens({ input: 1234, output: 0 })).toBe("1.2k tokens")
    expect(formatTokens({ input: 1567, output: 0 })).toBe("1.6k tokens")
  })
})

describe("formatModelName", () => {
  test("formats Claude models", () => {
    expect(formatModelName({ providerID: "anthropic", modelID: "claude-sonnet-4-20250514" })).toBe(
      "Claude Sonnet 4",
    )
    expect(formatModelName({ providerID: "anthropic", modelID: "claude-opus-4-20250514" })).toBe(
      "Claude Opus 4",
    )
    expect(
      formatModelName({ providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" }),
    ).toBe("Claude 3.5 Sonnet")
  })

  test("formats OpenAI models", () => {
    expect(formatModelName({ providerID: "openai", modelID: "gpt-4o" })).toBe("GPT-4o")
    expect(formatModelName({ providerID: "openai", modelID: "gpt-4o-mini" })).toBe("GPT-4o Mini")
    expect(formatModelName({ providerID: "openai", modelID: "o1" })).toBe("o1")
  })

  test("formats Google models", () => {
    expect(formatModelName({ providerID: "google", modelID: "gemini-2.0-flash" })).toBe(
      "Gemini 2.0 Flash",
    )
  })

  test("handles unknown models", () => {
    expect(formatModelName({ providerID: "unknown", modelID: "custom-model" })).toBe("Custom Model")
    expect(formatModelName({ providerID: "local", modelID: "llama-3.1-70b" })).toBe("Llama 3.1 70b")
  })

  test("handles undefined model", () => {
    expect(formatModelName(undefined)).toBe("Unknown Model")
  })

  test("removes date suffixes from unknown models", () => {
    expect(formatModelName({ providerID: "unknown", modelID: "my-model-20250101" })).toBe(
      "My Model",
    )
  })
})
