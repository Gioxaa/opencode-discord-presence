import { homedir } from "node:os"
import { join } from "node:path"
import type { Plugin } from "@opencode-ai/plugin"
import { getConfig } from "./config.js"
import { createRecapCleanupTask, DiscordRPCService } from "./services/discord-rpc.js"
import {
  createInitialPresenceState,
  type PresenceSnapshot,
  presenceReducer,
  updateFileAction,
  updateIdentity,
  updateIdle,
  updateRecapCache,
  updateTodoSummary,
} from "./state/presence-state.js"
import type { DiscordPresenceOptions, RichPresenceOptions } from "./types/index.js"
import {
  createSessionMetricsState,
  createSessionRecap,
  normalizeFileIdentity,
  recordFileTouch,
  recordMessageActivity,
  recordTaskContext,
  type SessionMetricsState,
} from "./utils/session-metrics.js"
import {
  clearSessionMetrics,
  loadSessionMetrics,
  saveSessionMetrics,
} from "./utils/session-persistence.js"
import { getToolLabel } from "./utils/tool-label.js"

async function loadConfigFile(directory: string): Promise<DiscordPresenceOptions | undefined> {
  const paths = [
    join(directory, ".discord-presence.json"),
    join(homedir(), ".discord-presence.json"),
  ]

  for (const configPath of paths) {
    const file = Bun.file(configPath)
    if (await file.exists()) {
      try {
        return (await file.json()) as DiscordPresenceOptions
      } catch (error) {
        console.warn("[discord-presence] Failed to load config file:", error)
      }
    }
  }
  return undefined
}

interface ToolExecuteInput {
  tool: string
  sessionID: string
  callID: string
}

interface ToolExecuteOutput {
  args?: unknown
  title?: string
  output?: string
  metadata?: Record<string, unknown>
}

/**
 * Captured context from tool.execute.before, keyed by callID for after-hook retrieval.
 * This is the ONLY contract-safe source of executable args for the after-hook.
 */
type CallIDContext = Map<
  string,
  {
    filePath?: string
    operation: string
  }
>

/**
 * Extracts a normalized file path from tool execute args if it looks like a file path.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: recursive traversal of unknown arg shape needed
function extractFilePathFromArgs(args?: unknown): string | undefined {
  if (!args) return undefined
  if (typeof args === "string") {
    const trimmed = args.trim()
    const quotedWithSingle = trimmed.startsWith("'") && trimmed.endsWith("'")
    const quotedWithDouble = trimmed.startsWith('"') && trimmed.endsWith('"')
    const wasQuoted = quotedWithSingle || quotedWithDouble
    const candidate = wasQuoted ? trimmed.slice(1, -1).trim() : trimmed

    if (!candidate || candidate.startsWith("-")) {
      return undefined
    }

    if (!(candidate.includes("/") || candidate.includes("\\"))) {
      return undefined
    }

    if (!wasQuoted && /\s/.test(candidate)) {
      return undefined
    }

    if (candidate.includes(" ")) {
      return undefined
    }

    return normalizeFileIdentity(candidate)
  }
  if (Array.isArray(args)) {
    for (const item of args) {
      const extracted = extractFilePathFromArgs(item)
      if (extracted) return extracted
    }
  }
  if (typeof args === "object") {
    for (const value of Object.values(args)) {
      const extracted = extractFilePathFromArgs(value)
      if (extracted) return extracted
    }
  }
  return undefined
}

/**
 * Counts how many rotating informational cards are active given the current options.
 */
function countRotatingCards(
  opts: RichPresenceOptions,
  hasWarnings: boolean,
  errors: number,
): number {
  let count = 0
  if (opts.enableFileSpotlight) count++
  if (opts.enableMissionBoard) count++
  if (hasWarnings && errors === 0) count++
  count++ // session-stats always present as ultimate fallback
  return Math.max(count, 1)
}

export const OpenCodeDiscordPresence: Plugin = async (ctx) => {
  const fileOptions = await loadConfigFile(ctx.directory)
  const config = getConfig(fileOptions)
  if (!config.enabled) return {}

  // Instance-scoped RPC service and presence state.
  let rpc: DiscordRPCService | null = new DiscordRPCService(config.clientId)
  let snapshot = createInitialPresenceState()

  // Contract-safe before/after hook state: callID-scoped context captured in before, retrieved in after.
  // This is the ONLY safe way to pass executable args from before→after since after.output lacks args.
  const callContext: CallIDContext = new Map()

  // Session metrics tracked separately due to Set serialization in SessionMetrics
  let sessionMetricsState: SessionMetricsState = createSessionMetricsState()
  // Try to restore session metrics from previous session (e.g., after crash or restart)
  const persisted = await loadSessionMetrics()
  if (persisted) {
    sessionMetricsState = persisted
  }

  // Rotation state
  let rotationIndex = 0
  let rotationTimer: ReturnType<typeof setInterval> | null = null

  /**
   * Pushes the current snapshot + live metrics to Discord via the rotation engine.
   */
  const pushPresence = async () => {
    if (!rpc) return
    // Derive sessionMetrics from live metrics state for every Discord push
    const snapshotWithMetrics: PresenceSnapshot = {
      ...snapshot,
      sessionMetrics: sessionMetricsState,
    }
    const hasWarnings = snapshot.diagnosticsSummary.warnings > 0
    const errors = snapshot.diagnosticsSummary.errors
    const cardCount = countRotatingCards(config.richPresence, hasWarnings, errors)
    rotationIndex = rotationIndex % cardCount
    await rpc.setPresenceFromSnapshot(
      snapshotWithMetrics,
      config.richPresence,
      rotationIndex,
      config.language,
    )
  }

  /**
   * Starts the rotation timer for informational cards.
   */
  const startRotationTimer = () => {
    if (rotationTimer) clearInterval(rotationTimer)
    const intervalMs = config.richPresence.rotationIntervalSeconds * 1000
    rotationTimer = setInterval(async () => {
      rotationIndex =
        (rotationIndex + 1) %
        countRotatingCards(
          config.richPresence,
          snapshot.diagnosticsSummary.warnings > 0,
          snapshot.diagnosticsSummary.errors,
        )
      await pushPresence()
    }, intervalMs)
  }

  /**
   * Stops the rotation timer.
   */
  const stopRotationTimer = () => {
    if (rotationTimer) {
      clearInterval(rotationTimer)
      rotationTimer = null
    }
  }

  /**
   * Exits idle mode if currently idle — called on any active event.
   */
  const exitIdleIfNeeded = async () => {
    if (snapshot.idle) {
      snapshot = presenceReducer(snapshot, updateIdle(false))
    }
  }

  const connected = rpc.isConnected() || (await rpc.connect())
  if (connected) {
    await pushPresence()
    startRotationTimer()
  }

  return {
    // ── chat.message ────────────────────────────────────────────────────────────
    "chat.message": async (input, _output) => {
      // Update agent/model identity
      snapshot = presenceReducer(
        snapshot,
        updateIdentity({
          agent: input.agent ?? snapshot.identity.agent,
          model: input.model?.modelID ?? snapshot.identity.model,
        }),
      )

      // Track message activity
      sessionMetricsState = recordMessageActivity(sessionMetricsState)
      await saveSessionMetrics(sessionMetricsState)

      // Exit idle on new chat activity
      await exitIdleIfNeeded()

      await pushPresence()
    },

    // ── tool.execute.before ───────────────────────────────────────────────────
    "tool.execute.before": async (input: ToolExecuteInput, output: ToolExecuteOutput) => {
      const toolName = input.tool ?? ""
      const callID = input.callID ?? ""
      const filePath = extractFilePathFromArgs(output.args)
      // Infer operation label with command context from args for bash commands
      const command = typeof output.args === "string" ? output.args : undefined
      const operation = getToolLabel({ toolName, command })

      // Capture context for after-hook retrieval via callID (contract-safe args path)
      if (callID) {
        callContext.set(callID, { filePath, operation })
      }

      if (filePath) {
        snapshot = presenceReducer(
          snapshot,
          updateFileAction({ file: filePath, action: toolName, operation }),
        )
        sessionMetricsState = recordFileTouch(sessionMetricsState, filePath)
        await saveSessionMetrics(sessionMetricsState)
      } else {
        snapshot = presenceReducer(snapshot, updateFileAction({ action: toolName, operation }))
      }

      await exitIdleIfNeeded()
      await pushPresence()
    },

    // ── tool.execute.after ────────────────────────────────────────────────────
    // IMPORTANT: output.shape is { title, output, metadata } — NO args field per contract.
    // File context is retrieved from before-hook capture via callID (the ONLY contract-safe path).
    "tool.execute.after": async (input: ToolExecuteInput, _output: ToolExecuteOutput) => {
      const toolName = input.tool ?? ""
      const callID = input.callID ?? ""

      // Retrieve captured context from before-hook (contract-safe args source)
      const captured = callContext.get(callID)
      const filePath = captured?.filePath
      const operation = captured?.operation ?? getToolLabel({ toolName })

      // Clean up captured context after retrieval to avoid memory leak
      if (callID) {
        callContext.delete(callID)
      }

      if (filePath) {
        snapshot = presenceReducer(
          snapshot,
          updateFileAction({ file: filePath, action: toolName, operation }),
        )
        sessionMetricsState = recordFileTouch(sessionMetricsState, filePath)
        await saveSessionMetrics(sessionMetricsState)
      } else {
        snapshot = presenceReducer(snapshot, updateFileAction({ action: toolName, operation }))
      }

      await exitIdleIfNeeded()
      await pushPresence()
    },

    // ── Generic event hook ────────────────────────────────────────────────────
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: event dispatch pattern requires all branches
    event: async ({ event }) => {
      const eventType = event.type

      // ── file.edited ───────────────────────────────────────────────────────
      if (eventType === "file.edited") {
        const filePath = (event.properties as { file?: string } | undefined)?.file
        if (filePath) {
          const normalized = normalizeFileIdentity(filePath)
          snapshot = presenceReducer(
            snapshot,
            updateFileAction({
              file: normalized,
              action: "edit",
              operation: "Editing",
            }),
          )
          sessionMetricsState = recordFileTouch(sessionMetricsState, normalized)
          await saveSessionMetrics(sessionMetricsState)
        }
        await exitIdleIfNeeded()
        await pushPresence()
        return
      }

      // ── todo.updated ──────────────────────────────────────────────────────
      if (eventType === "todo.updated") {
        const props = event.properties as
          | {
              todos?: Array<{
                content?: string
                status?: string
                priority?: string
              }>
              sessionID?: string
            }
          | undefined
        const todos = props?.todos

        if (Array.isArray(todos)) {
          const total = todos.length
          const completed = todos.filter((t) => t.status === "completed").length
          const pending = total - completed
          const allDone = completed === total && total > 0

          const activeTodo =
            todos.find((t) => t.status === "in_progress") ??
            todos.find((t) => t.status === "pending")
          const activeTaskLabel = activeTodo?.content

          snapshot = presenceReducer(
            snapshot,
            updateTodoSummary({
              total,
              completed,
              pending,
              allDone,
              activeTaskLabel,
            }),
          )

          if (activeTaskLabel) {
            sessionMetricsState = recordTaskContext(sessionMetricsState, activeTaskLabel)
            await saveSessionMetrics(sessionMetricsState)
          }
        }

        await exitIdleIfNeeded()
        await pushPresence()
        return
      }

      // ── lsp.client.diagnostics ─────────────────────────────────────────────
      if (eventType === "lsp.client.diagnostics") {
        // lsp.client.diagnostics is a notification that diagnostics changed for a path.
        // The OpenCode plugin API does not provide error/warning counts through this event.
        // We cannot implement the diagnostics-error pin in v1 from this event alone.
        ctx.client.app.log({
          body: {
            service: "discord-presence",
            level: "info",
            message: `lsp.client.diagnostics received for ${(event.properties as { path?: string } | undefined)?.path} — diagnostic counts unavailable in v1 plugin API`,
          },
        })
        return
      }

      // ── session.idle ──────────────────────────────────────────────────────
      if (eventType === "session.idle") {
        snapshot = presenceReducer(snapshot, updateIdle(true))
        await pushPresence()
        return
      }

      // ── session.deleted ───────────────────────────────────────────────────
      if (eventType === "session.deleted") {
        stopRotationTimer()

        // Build recap from accumulated metrics
        const recap = createSessionRecap(sessionMetricsState)
        await clearSessionMetrics()
        snapshot = presenceReducer(
          snapshot,
          updateRecapCache({
            ...recap,
            timestamp: Date.now(),
          }),
        )

        await pushPresence()

        const recapRpc = rpc
        rpc = null
        const clearRecap = () => {
          snapshot = presenceReducer(snapshot, updateRecapCache({}))
        }
        const cleanupRecap = createRecapCleanupTask(recapRpc, clearRecap)

        // After 30 seconds, clear recap state and tear down the specific RPC session
        setTimeout(() => {
          void cleanupRecap()
        }, 30_000)

        return
      }

      // ── Unknown event type (non-crashing fallback) ──────────────────────────
      ctx.client.app.log({
        body: {
          service: "discord-presence",
          level: "info",
          message: `Unhandled event type: ${eventType}`,
        },
      })
    },
  }
}
