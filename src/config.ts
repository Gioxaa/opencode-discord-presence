import type { DiscordPresenceOptions, Language, PresenceConfig } from "./types/index.js"

export const DEFAULT_CLIENT_ID = "1466770544748662819"

function parseLanguage(lang?: string): Language {
  const normalized = lang?.toLowerCase()
  if (normalized === "ko" || normalized === "kr" || normalized === "korean") return "ko"
  return "en"
}

export function getConfig(options?: DiscordPresenceOptions): PresenceConfig {
  const envEnabled = process.env.OPENCODE_DISCORD_ENABLED
  const envClientId = process.env.OPENCODE_DISCORD_CLIENT_ID
  const envLanguage = process.env.OPENCODE_DISCORD_LANGUAGE

  return {
    enabled: options?.enabled ?? envEnabled !== "false",
    clientId: options?.applicationId ?? envClientId ?? DEFAULT_CLIENT_ID,
    language: parseLanguage(options?.language ?? envLanguage),
  }
}
