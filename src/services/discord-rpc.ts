/**
 * @fileoverview Discord RPC Service for Rich Presence
 * @module opencode-discord-presence/services/discord-rpc
 *
 * Provides a singleton service for managing Discord Rich Presence connection.
 * Features:
 * - Singleton pattern for single connection per application
 * - Automatic reconnection with exponential backoff
 * - Debounced presence updates to avoid rate limiting
 * - Event-driven connection management
 */

import { Client, type SetActivity } from "@xhayper/discord-rpc"
import type { PresenceState } from "../types/index.js"

/** Reconnection configuration */
const RECONNECT_BASE_DELAY_MS = 5000
const RECONNECT_MAX_ATTEMPTS = 10

/** Debounce configuration */
const DEBOUNCE_DELAY_MS = 100 // Short debounce for batching rapid updates

/**
 * Singleton service for managing Discord Rich Presence
 *
 * @example
 * ```typescript
 * const rpc = DiscordRPCService.getInstance("your-client-id")
 * await rpc.connect()
 * await rpc.updatePresence({
 *   details: "Working on project",
 *   state: "Using Claude",
 *   largeImageKey: "opencode-logo"
 * })
 * ```
 */
export class DiscordRPCService {
  private static instance: DiscordRPCService | null = null
  private static currentClientId: string | null = null

  private client: Client
  private _isConnected = false
  private reconnectAttempts = 0
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingPresence: SetActivity | null = null

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor(clientId: string) {
    this.client = new Client({ clientId })
    this.setupEventHandlers()
  }

  /**
   * Get the singleton instance of DiscordRPCService
   *
   * @param clientId - Discord Application ID
   * @returns The singleton instance
   */
  static getInstance(clientId: string): DiscordRPCService {
    if (!DiscordRPCService.instance || DiscordRPCService.currentClientId !== clientId) {
      DiscordRPCService.instance = new DiscordRPCService(clientId)
      DiscordRPCService.currentClientId = clientId
    }
    return DiscordRPCService.instance
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  static resetInstance(): void {
    if (DiscordRPCService.instance) {
      DiscordRPCService.instance.disconnect().catch(() => {})
    }
    DiscordRPCService.instance = null
    DiscordRPCService.currentClientId = null
  }

  /**
   * Whether the service is currently connected to Discord
   */
  get isConnected(): boolean {
    return this._isConnected
  }

  /**
   * Set up event handlers for the Discord RPC client
   */
  private setupEventHandlers(): void {
    this.client.on("ready", () => {
      console.log("[discord-rpc] Connected to Discord")
      this._isConnected = true
      this.reconnectAttempts = 0
    })

    this.client.on("disconnected", () => {
      console.log("[discord-rpc] Disconnected from Discord")
      this._isConnected = false
      this.attemptReconnect()
    })
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      console.warn(
        `[discord-rpc] Max reconnection attempts (${RECONNECT_MAX_ATTEMPTS}) reached. Giving up.`,
      )
      return
    }

    this.reconnectAttempts++
    const delay = RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempts - 1)

    console.log(
      `[discord-rpc] Attempting reconnect ${this.reconnectAttempts}/${RECONNECT_MAX_ATTEMPTS} in ${delay}ms`,
    )

    await new Promise((resolve) => setTimeout(resolve, delay))

    try {
      await this.connect()
    } catch (error) {
      console.error("[discord-rpc] Reconnection failed:", error)
    }
  }

  /**
   * Connect to Discord RPC
   *
   * @throws Error if connection fails and not retrying
   */
  async connect(): Promise<void> {
    if (this._isConnected) {
      return
    }

    try {
      await this.client.login()
      this._isConnected = true
    } catch (error) {
      console.warn("[discord-rpc] Failed to connect:", error)
      // Don't throw - Discord might not be running
      this._isConnected = false
    }
  }

  /**
   * Disconnect from Discord RPC
   */
  async disconnect(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    try {
      await this.client.destroy()
    } catch (_error) {
      // Ignore errors during disconnect
    }
    this._isConnected = false
  }

  /**
   * Update the Rich Presence with debouncing
   *
   * @param presence - The presence state to set
   */
  async updatePresence(presence: PresenceState): Promise<void> {
    if (!this._isConnected || !this.client.user) {
      return
    }

    // Store pending presence and debounce
    this.pendingPresence = {
      details: presence.details,
      state: presence.state,
      startTimestamp: presence.startTimestamp,
      largeImageKey: presence.largeImageKey,
      largeImageText: presence.largeImageText,
      smallImageKey: presence.smallImageKey,
      smallImageText: presence.smallImageText,
    }

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(async () => {
      if (this.pendingPresence && this._isConnected && this.client.user) {
        try {
          await this.client.user.setActivity(this.pendingPresence)
        } catch (error) {
          console.warn("[discord-rpc] Failed to update presence:", error)
        }
      }
      this.pendingPresence = null
    }, DEBOUNCE_DELAY_MS)
  }

  /**
   * Clear the Rich Presence
   */
  async clearPresence(): Promise<void> {
    if (!this._isConnected || !this.client.user) {
      return
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    try {
      await this.client.user.clearActivity()
    } catch (error) {
      console.warn("[discord-rpc] Failed to clear presence:", error)
    }
  }
}
