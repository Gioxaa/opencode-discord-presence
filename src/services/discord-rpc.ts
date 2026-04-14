import { Client } from "@xhayper/discord-rpc"
import type { PresenceSnapshot } from "../state/presence-state.js"
import type { RichPresenceOptions, SetActivity } from "../types/index.js"
import { getActivity } from "../utils/activity-rotation.js"

const RECONNECT_DELAY = 5000
const MAX_RETRIES = 10
const DEBOUNCE_MS = 100
const MAX_DETAILS_LENGTH = 126
const MAX_STATE_LENGTH = 126

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return `${str.slice(0, maxLen - 1)}…`
}

export { MAX_RETRIES }

/**
 * DiscordRPCService — hardened Discord Rich Presence client.
 *
 * Test injection points (prefixed with _ for clarity — these are part of the
 * testable surface of the class):
 *   _setConnected(connected: boolean)  — override internal connected flag
 *   _overrideClient(client: Client)     — replace the RPC client for unit tests
 *   _getState()                       — returns current internal state snapshot
 *   _setClearTimeoutimpl(fn: typeof setTimeout) — inject fake setTimeout for timer tests
 */
export class DiscordRPCService {
  private client: Client | null = null
  private connected = false
  private retryCount = 0
  private sessionStart: Date = new Date()
  private currentPresence: SetActivity | null = null

  // ── Lifecycle flags ───────────────────────────────────────────────────────
  /** True when the session has been explicitly cleared and should not replay on reconnect. */
  private cleared = false
  /** True when disconnect() has been called — prevents further reconnect scheduling. */
  private disconnecting = false

  // ── Debounce/throttle state ─────────────────────────────────────────────
  private pendingUpdate: SetActivity | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  // ── Timer injection (for testing) ──────────────────────────────────────
  private _setTimeoutImpl: typeof setTimeout = setTimeout
  private _clearTimeoutImpl: typeof clearTimeout = clearTimeout

  // ── Reconnect timer ──────────────────────────────────────────────────────
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private clientId: string) {}

  // ─── Test injection points ───────────────────────────────────────────────

  /** Override the connected flag (for testing without real RPC). */
  _setConnected(connected: boolean) {
    this.connected = connected
  }

  /** Replace the Discord client (for testing without real network). */
  _overrideClient(client: Client) {
    this.client = client
  }

  /** Replace setTimeout/clearTimeout (for testing debounce timers). */
  _setTimerImpl(setTimeoutImpl: typeof setTimeout, clearTimeoutImpl: typeof clearTimeout) {
    this._setTimeoutImpl = setTimeoutImpl
    this._clearTimeoutImpl = clearTimeoutImpl
  }

  /** Returns a snapshot of key internal state for assertion in tests. */
  _getState() {
    return {
      connected: this.connected,
      cleared: this.cleared,
      disconnecting: this.disconnecting,
      retryCount: this.retryCount,
      hasPendingUpdate: this.pendingUpdate !== null,
      hasDebounceTimer: this.debounceTimer !== null,
      hasCurrentPresence: this.currentPresence !== null,
    }
  }

  // ─── Connection ──────────────────────────────────────────────────────────

  async connect(): Promise<boolean> {
    if (this.connected) return true

    return new Promise((resolve) => {
      try {
        this.client = new Client({ clientId: this.clientId })

        this.client.on("ready", () => {
          this.connected = true
          this.retryCount = 0
          console.log("[discord-presence] Connected to Discord")

          // Only replay presence if we have one AND the session was not cleared
          if (this.currentPresence && !this.cleared) {
            this.client?.user?.setActivity(this.currentPresence).catch((err) => {
              console.warn("[discord-presence] Failed to replay presence:", err)
            })
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
    if (this.disconnecting) return
    if (this.retryCount >= MAX_RETRIES) {
      console.log("[discord-presence] Max retries reached — not scheduling further reconnects")
      return
    }
    this.retryCount++
    if (this.reconnectTimer) {
      this._clearTimeoutImpl(this.reconnectTimer)
    }
    this.reconnectTimer = this._setTimeoutImpl(() => {
      this.reconnectTimer = null
      this.connect()
    }, RECONNECT_DELAY)
  }

  /**
   * Explicitly disconnects and prevents any further reconnect attempts.
   * Clears all connection state and pending updates.
   */
  disconnect() {
    this.disconnecting = true
    this.connected = false
    this.retryCount = 0
    this.cleared = true

    if (this.debounceTimer) {
      this._clearTimeoutImpl(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.reconnectTimer) {
      this._clearTimeoutImpl(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.pendingUpdate = null
    this.currentPresence = null

    if (this.client) {
      this.client = null
    }
  }

  // ─── Presence updates (throttled/debounced) ───────────────────────────────

  async setPresence(
    details: string,
    state?: string,
    assets?: {
      largeImageKey?: string
      largeImageText?: string
      smallImageKey?: string
      smallImageText?: string
    },
  ): Promise<void> {
    const activity: SetActivity = {
      details,
      state,
      startTimestamp: this.sessionStart,
      largeImageKey: assets?.largeImageKey ?? "opencode-logo",
      largeImageText: assets?.largeImageText ?? "OpenCode",
      smallImageKey: assets?.smallImageKey,
      smallImageText: assets?.smallImageText,
    }

    this.currentPresence = activity
    this.cleared = false

    this.scheduleUpdate(activity)
  }

  private scheduleUpdate(activity: SetActivity) {
    this.pendingUpdate = activity
    if (this.debounceTimer) return

    this.debounceTimer = this._setTimeoutImpl(() => {
      this.debounceTimer = null
      this.flushPendingUpdate()
    }, DEBOUNCE_MS)
  }

  private flushPendingUpdate() {
    if (!this.pendingUpdate) return
    if (!this.connected || !this.client?.user) return

    const activity = this.pendingUpdate
    this.pendingUpdate = null

    try {
      this.client.user.setActivity(activity).catch((err) => {
        console.warn("[discord-presence] Failed to update:", err)
      })
    } catch (error) {
      console.warn("[discord-presence] Failed to update:", error)
    }
  }

  async setPresenceFromSnapshot(
    snapshot: PresenceSnapshot,
    opts: RichPresenceOptions,
    rotationIndex: number,
  ): Promise<void> {
    const activity = getActivity(snapshot, opts, rotationIndex)
    await this.setPresence(
      truncate(activity.details, MAX_DETAILS_LENGTH),
      activity.state ? truncate(activity.state, MAX_STATE_LENGTH) : undefined,
      activity.assets,
    )
  }

  // ─── Clear ──────────────────────────────────────────────────────────────

  async clear(): Promise<void> {
    this.cleared = true
    this.currentPresence = null

    if (this.debounceTimer) {
      this._clearTimeoutImpl(this.debounceTimer)
      this.debounceTimer = null
    }
    this.pendingUpdate = null

    if (!this.connected || !this.client?.user) return
    try {
      await this.client.user.clearActivity()
    } catch (error) {
      console.warn("[discord-presence] Failed to clear activity:", error)
    }
  }

  isConnected(): boolean {
    return this.connected
  }
}
