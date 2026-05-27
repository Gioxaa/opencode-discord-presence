import { Client } from "@xhayper/discord-rpc"
import type { SetActivity } from "../types/index.js"

const RECONNECT_DELAY = 5000
const MAX_RETRIES = 10

export interface DiscordRPCOptions {
  debug?: boolean
}

export class DiscordRPCService {
  private client: Client | null = null
  private connected = false
  private retryCount = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private sessionStart: Date = new Date()
  private currentPresence: SetActivity | null = null
  private updateSeq = 0
  private appliedSeq = 0
  private shuttingDown = false
  private readonly debug: boolean

  constructor(
    private clientId: string,
    options: DiscordRPCOptions = {},
  ) {
    this.debug = options.debug ?? false
  }

  async connect(): Promise<boolean> {
    if (this.connected) return true

    return new Promise((resolve) => {
      try {
        this.client = new Client({ clientId: this.clientId })

        this.client.on("ready", () => {
          this.connected = true
          this.retryCount = 0
          this.log("Connected to Discord")

          if (this.currentPresence) {
            this.client?.user?.setActivity(this.currentPresence).catch(() => {})
          }

          resolve(true)
        })

        this.client.on("disconnected", () => {
          this.connected = false
          if (this.shuttingDown) return
          this.log("Disconnected")
          this.scheduleReconnect()
        })

        this.client.login().catch((err) => {
          this.log("Connection failed:", err?.message || err)
          this.scheduleReconnect()
          resolve(false)
        })
      } catch (error) {
        this.log("Error:", error)
        this.scheduleReconnect()
        resolve(false)
      }
    })
  }

  async disconnect(): Promise<void> {
    this.shuttingDown = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.retryCount = MAX_RETRIES
    this.currentPresence = null
    if (this.client) {
      try {
        await this.client.destroy()
      } catch {}
      this.client = null
    }
    this.connected = false
  }

  async setPresence(details: string, state?: string) {
    const seq = ++this.updateSeq
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

    if (seq < this.appliedSeq) return

    try {
      await this.client.user.setActivity(activity)
      if (seq > this.appliedSeq) this.appliedSeq = seq
    } catch (error) {
      this.warn("Failed to update:", error)
    }
  }

  async clear() {
    const seq = ++this.updateSeq
    this.currentPresence = null
    if (!this.connected || !this.client?.user) return
    if (seq < this.appliedSeq) return
    try {
      await this.client.user.clearActivity()
      if (seq > this.appliedSeq) this.appliedSeq = seq
    } catch {}
  }

  resetSessionStart(): void {
    this.sessionStart = new Date()
  }

  isConnected(): boolean {
    return this.connected
  }

  private scheduleReconnect() {
    if (this.retryCount >= MAX_RETRIES) {
      this.log("Max retries reached")
      return
    }
    this.retryCount++
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY)
    this.reconnectTimer.unref?.()
  }

  private log(message: string, ...args: unknown[]): void {
    if (!this.debug) return
    console.log(`[discord-presence] ${message}`, ...args)
  }

  private warn(message: string, ...args: unknown[]): void {
    if (!this.debug) return
    console.warn(`[discord-presence] ${message}`, ...args)
  }
}
