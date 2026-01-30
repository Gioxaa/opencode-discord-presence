import { Client } from "@xhayper/discord-rpc"
import type { SetActivity } from "../types/index.js"

const RECONNECT_DELAY = 5000
const MAX_RETRIES = 10

export class DiscordRPCService {
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

  isConnected(): boolean {
    return this.connected
  }
}
