import type { PresenceConfig } from "./types/index.js"

export const DEFAULT_CLIENT_ID = "1334049498592313364"

export function getConfig(): PresenceConfig {
  return {
    enabled: process.env.OPENCODE_DISCORD_ENABLED !== "false",
    clientId: process.env.OPENCODE_DISCORD_CLIENT_ID || DEFAULT_CLIENT_ID,
  }
}
