import type { DiscordPresenceOptions, Language, PresenceConfig } from "./types/index.js"

export const DEFAULT_CLIENT_ID = "1466770544748662819"

function parseLanguage(lang?: string): Language {
  const normalized = lang?.toLowerCase()
  if (normalized === "ko" || normalized === "kr" || normalized === "korean") return "ko"
  return "en"
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined
  const v = value.toLowerCase()
  if (v === "true" || v === "1" || v === "yes") return true
  if (v === "false" || v === "0" || v === "no") return false
  return undefined
}

export function getConfig(options?: DiscordPresenceOptions): PresenceConfig {
  const envEnabled = process.env.OPENCODE_DISCORD_ENABLED
  const envClientId = process.env.OPENCODE_DISCORD_CLIENT_ID
  const envLanguage = process.env.OPENCODE_DISCORD_LANGUAGE
  const envDebug = process.env.OPENCODE_DISCORD_DEBUG

  return {
    enabled: options?.enabled ?? envEnabled !== "false",
    clientId: options?.applicationId ?? envClientId ?? DEFAULT_CLIENT_ID,
    language: parseLanguage(options?.language ?? envLanguage),
    debug: options?.debug ?? parseBool(envDebug) ?? false,
  }
}
