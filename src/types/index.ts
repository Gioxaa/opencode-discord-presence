import type { SetActivity } from "@xhayper/discord-rpc"

export type Language = "en" | "ko"

export interface PresenceConfig {
  enabled: boolean
  clientId: string
  language: Language
}

export interface DiscordPresenceOptions {
  enabled?: boolean
  applicationId?: string
  language?: string
}

export interface PresenceState {
  agent: string
  model: string
  idle: boolean
}

export type { SetActivity }
