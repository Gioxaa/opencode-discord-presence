import type { SetActivity } from "@xhayper/discord-rpc"

export interface PresenceConfig {
  enabled: boolean
  clientId: string
}

export interface PresenceState {
  agent: string
  model: string
  idle: boolean
}

export type { SetActivity }
