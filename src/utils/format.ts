/**
 * @fileoverview Formatting utilities for tokens and model names
 * @module opencode-discord-presence/utils/format
 *
 * Provides formatting functions for displaying token counts and model names
 * in a user-friendly way for Discord Rich Presence.
 */

import type { ModelInfo, TokenCount } from "../types/index.js"

/**
 * Format token count for display
 *
 * @param tokens - Token count object with input and output
 * @returns Formatted string like "12.5k tokens" or "700 tokens"
 *
 * @example
 * ```typescript
 * formatTokens({ input: 8200, output: 4300 }) // "12.5k tokens"
 * formatTokens({ input: 500, output: 200 })   // "700 tokens"
 * formatTokens({ input: 0, output: 0 })       // "0 tokens"
 * ```
 */
export function formatTokens(tokens: TokenCount): string {
  const total = tokens.input + tokens.output

  if (total === 0) {
    return "0 tokens"
  }

  if (total >= 1000) {
    const k = total / 1000
    // Round to 1 decimal place
    const rounded = Math.round(k * 10) / 10
    return `${rounded}k tokens`
  }

  return `${total} tokens`
}

/**
 * Model name mappings for common providers
 */
const MODEL_NAME_MAPPINGS: Record<string, Record<string, string>> = {
  anthropic: {
    "claude-opus-4-20250514": "Claude Opus 4",
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
    "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
    "claude-3-opus-20240229": "Claude 3 Opus",
    "claude-3-sonnet-20240229": "Claude 3 Sonnet",
    "claude-3-haiku-20240307": "Claude 3 Haiku",
  },
  openai: {
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gpt-4": "GPT-4",
    "gpt-3.5-turbo": "GPT-3.5 Turbo",
    o1: "o1",
    "o1-mini": "o1 Mini",
    "o1-preview": "o1 Preview",
  },
  google: {
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    "gemini-1.5-flash": "Gemini 1.5 Flash",
  },
}

/**
 * Format model name for display
 *
 * Converts model IDs like "claude-sonnet-4-20250514" to human-readable
 * names like "Claude Sonnet 4".
 *
 * @param model - Model info with providerID and modelID
 * @returns Human-readable model name
 *
 * @example
 * ```typescript
 * formatModelName({ providerID: "anthropic", modelID: "claude-sonnet-4-20250514" })
 * // "Claude Sonnet 4"
 *
 * formatModelName({ providerID: "openai", modelID: "gpt-4o" })
 * // "GPT-4o"
 *
 * formatModelName({ providerID: "unknown", modelID: "custom-model" })
 * // "custom-model"
 * ```
 */
export function formatModelName(model: ModelInfo | undefined): string {
  if (!model) {
    return "Unknown Model"
  }

  const { providerID, modelID } = model
  const providerMappings = MODEL_NAME_MAPPINGS[providerID]

  if (providerMappings?.[modelID]) {
    return providerMappings[modelID]
  }

  // Try to make the model ID more readable
  // Remove version suffixes like -20250514
  let readable = modelID.replace(/-\d{8}$/, "")

  // Capitalize first letter of each word
  readable = readable
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

  return readable || modelID
}
