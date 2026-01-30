import type { Plugin } from "@opencode-ai/plugin"
import { Client, type SetActivity } from "@xhayper/discord-rpc"

const DEFAULT_CLIENT_ID = "1334049498592313364"
const RECONNECT_DELAY = 5000
const MAX_RETRIES = 10

interface PresenceConfig {
  enabled: boolean
  clientId: string
  showSessionTime: boolean
}

function getConfig(): PresenceConfig {
  return {
    enabled: process.env.OPENCODE_DISCORD_ENABLED !== "false",
    clientId: process.env.OPENCODE_DISCORD_CLIENT_ID || DEFAULT_CLIENT_ID,
    showSessionTime: true,
  }
}

class DiscordRPC {
  private client: Client | null = null
  private connected = false
  private connecting = false
  private retryCount = 0
  private sessionStart: Date | null = null

  constructor(private clientId: string) {}

  async connect(): Promise<boolean> {
    if (this.connected || this.connecting) return this.connected

    this.connecting = true
    try {
      this.client = new Client({ clientId: this.clientId })

      this.client.on("ready", () => {
        this.connected = true
        this.connecting = false
        this.retryCount = 0
        console.log("[discord-presence] Connected")
      })

      this.client.on("disconnected", () => {
        this.connected = false
        console.log("[discord-presence] Disconnected")
        this.scheduleReconnect()
      })

      await this.client.login()
      return true
    } catch (error) {
      this.connecting = false
      this.scheduleReconnect()
      return false
    }
  }

  private scheduleReconnect() {
    if (this.retryCount >= MAX_RETRIES) return
    this.retryCount++
    setTimeout(() => this.connect(), RECONNECT_DELAY)
  }

  startSession() {
    this.sessionStart = new Date()
  }

  async setPresence(details: string, state?: string) {
    if (!this.connected || !this.client?.user) return

    const activity: SetActivity = {
      details,
      state,
      largeImageKey: "opencode-logo",
      largeImageText: "OpenCode",
    }

    if (this.sessionStart) {
      activity.startTimestamp = this.sessionStart
    }

    try {
      await this.client.user.setActivity(activity)
    } catch (error) {
      console.warn("[discord-presence] Failed to update:", error)
    }
  }

  async clear() {
    if (!this.connected || !this.client?.user) return
    try {
      await this.client.user.clearActivity()
    } catch {}
  }
}

let rpc: DiscordRPC | null = null
let currentAgent = "OpenCode"
let currentModel = ""

export const OpenCodeDiscordPresence: Plugin = async (ctx) => {
  const config = getConfig()
  if (!config.enabled) return {}

  rpc = new DiscordRPC(config.clientId)
  await rpc.connect()
  rpc.startSession()

  const updatePresence = async (idle = false) => {
    if (!rpc) return
    const details = idle ? `${currentAgent} is idle` : `Working with ${currentAgent}`
    const state = currentModel || undefined
    await rpc.setPresence(details, state)
  }

  return {
    "chat.message": async (input) => {
      if (input.agent) currentAgent = input.agent
      if (input.model) currentModel = String(input.model).split("-")[0]
      await updatePresence(false)
    },

    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await updatePresence(true)
      }
    },
  }
}

export default OpenCodeDiscordPresence
export { getConfig }
