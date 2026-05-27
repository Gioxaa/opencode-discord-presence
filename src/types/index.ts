import type { SetActivity } from "@xhayper/discord-rpc"

export type Language = "en" | "ko"

/**
 * Minimal diagnostics config structure for future-safe extensibility.
 * v1 fix pins errors only, but config exposes errorsOnly to allow
 * future promotion of warnings without a breaking config change.
 */
export interface RichPresenceDiagnosticsConfig {
  errorsOnly: boolean
}

/**
 * Rich presence behavior options.
 * Keep surface minimal and only as broad as Task 3 requires.
 */
export interface RichPresenceOptions {
  enableFileSpotlight: boolean
  enableMissionBoard: boolean
  rotationIntervalSeconds: number
  diagnostics: RichPresenceDiagnosticsConfig
}

export interface PresenceConfig {
  enabled: boolean
  clientId: string
  language: Language
  richPresence: RichPresenceOptions
  debug: boolean
}

export interface DiscordPresenceOptions {
  enabled?: boolean
  applicationId?: string
  discordPresence?: {
    applicationId?: string
  }
  language?: string
  richPresence?: Partial<RichPresenceOptions>
  debug?: boolean
}

export interface PresenceState {
  agent: string
  model: string
  idle: boolean
}

export type { SetActivity }
