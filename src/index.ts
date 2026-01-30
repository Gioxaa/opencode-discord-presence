import type { Plugin } from "@opencode-ai/plugin"
import { Client, type SetActivity } from "@xhayper/discord-rpc"

const DEFAULT_CLIENT_ID = "1334049498592313364"
const RECONNECT_DELAY = 5000
const MAX_RETRIES = 10

interface PresenceConfig {
  enabled: boolean
  clientId: string
}

function getConfig(): PresenceConfig {
  return {
    enabled: process.env.OPENCODE_DISCORD_ENABLED !== "false",
    clientId: process.env.OPENCODE_DISCORD_CLIENT_ID || DEFAULT_CLIENT_ID,
  }
}

class DiscordRPC {
  private client: Client | null = null
  private connected = false
  private retryCount = 0
  private sessionStart: Date = new Date()
  private currentPresence: SetActivity | null = null

  constructor(private clientId: string) {}

  async connect(): Promise<boolean> {
    if (this.connected) return true

    return new Promise((resolve) => {
      try {
        this.client = new Client({ clientId: this.clientId })

        this.client.on("ready", () => {
          this.connected = true
          this.retryCount = 0
          console.log("[discord-presence] Connected to Discord")

          if (this.currentPresence) {
            this.client?.user?.setActivity(this.currentPresence).catch(() => {})
          }

          resolve(true)
        })

        this.client.on("disconnected", () => {
          this.connected = false
          console.log("[discord-presence] Disconnected")
          this.scheduleReconnect()
        })

        this.client.login().catch((err) => {
          console.log("[discord-presence] Connection failed:", err?.message || err)
          this.scheduleReconnect()
          resolve(false)
        })
      } catch (error) {
        console.log("[discord-presence] Error:", error)
        this.scheduleReconnect()
        resolve(false)
      }
    })
  }

  private scheduleReconnect() {
    if (this.retryCount >= MAX_RETRIES) {
      console.log("[discord-presence] Max retries reached")
      return
    }
    this.retryCount++
    setTimeout(() => this.connect(), RECONNECT_DELAY)
  }

  async setPresence(details: string, state?: string) {
    const activity: SetActivity = {
      details,
      state,
      startTimestamp: this.sessionStart,
      largeImageKey: "opencode-logo",
      largeImageText: "OpenCode",
    }

    this.currentPresence = activity

    if (!this.connected || !this.client?.user) {
      return
    }

    try {
      await this.client.user.setActivity(activity)
    } catch (error) {
      console.warn("[discord-presence] Failed to update:", error)
    }
  }

  async clear() {
    this.currentPresence = null
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

  const updatePresence = async (idle = false) => {
    if (!rpc) return
    const details = idle ? `${currentAgent} is idle` : `Working with ${currentAgent}`
    const state = currentModel || undefined
    await rpc.setPresence(details, state)
  }

  const connected = await rpc.connect()
  if (connected) {
    await updatePresence(false)
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
      if (event.type === "session.deleted") {
        await rpc?.clear()
      }
    },
  }
}

export default OpenCodeDiscordPresence
export { getConfig }
