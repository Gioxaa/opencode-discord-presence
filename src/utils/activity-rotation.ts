/**
 * Hybrid rotation and precedence selection engine for Discord Rich Presence.
 *
 * Precedence (highest to lowest):
 *  1. session-deleted recap card (recapCache present)
 *  2. diagnostics-error (errors > 0)
 *  3. idle
 *  4. all-tasks-complete (allDone && total > 0)
 *  5. active-operation + file spotlight (rotating informational)
 *  6. task mission board (rotating informational)
 *  7. diagnostics-warnings (rotating informational, warnings > 0, errors = 0)
 *  8. session stats (rotating informational)
 *  9. fallback: agent-centric headline only
 *
 * Critical states pin. Informational states rotate on a configurable interval.
 */

import type { PresenceSnapshot } from "../state/presence-state"
import type { RichPresenceOptions } from "../types/index.js"
import { getFileIconKey } from "./file-icons.js"
import { formatFileLabel } from "./file-label.js"
import { getToolLabel, type ToolLabelInput } from "./tool-label.js"

const MAX_STATE_LENGTH = 42

/** Time period (ms) after which a recap is considered stale. */
const RECAP_STALE_MS = 30_000

/** Maps tool-label operation names to emoji for file spotlight headlines. */
const OPERATION_EMOJI: Record<string, string> = {
  Editing: "✍️",
  Reading: "📖",
  Searching: "🔍",
  "Running tests": "🧪",
  Building: "🔨",
  Diagnosing: "🩺",
  Working: "⚙️",
  Executing: "⚡",
}

function getOperationEmoji(operation: string): string {
  return OPERATION_EMOJI[operation] ?? "📝"
}

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

function formatStatsLine(metrics: PresenceSnapshot["sessionMetrics"]): string {
  const prompts = metrics.messageCount
  const files = metrics.uniqueFilesTouched?.size ?? 0
  const duration = formatDuration(metrics.activeDurationSeconds)
  return `${prompts} prompts • ${files} files • ${duration}`
}

function formatTaskLine(todo: PresenceSnapshot["todoSummary"]): string {
  if (!todo || todo.total === 0) return ""
  const label = todo.activeTaskLabel
    ? truncateTaskLabel(todo.activeTaskLabel, MAX_STATE_LENGTH)
    : ""
  return `${label ? `${label} ` : ""}(${todo.completed}/${todo.total})`
}

function truncateTaskLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label
  return `${label.slice(0, maxLength - 1)}…`
}

/** Which rotating informational card is active given the current index. */
export type RotatingCard =
  | "file-spotlight"
  | "task-mission-board"
  | "diagnostics-warnings"
  | "session-stats"

/**
 * Maps a rotation index to a RotatingCard, honouring enabled/disabled features
 * and whether the warnings rotating card is relevant (warnings > 0 && errors = 0).
 * Returns null when all rotating cards are disabled.
 */
export function resolveRotatingCard(
  index: number,
  opts: RichPresenceOptions,
  hasWarnings: boolean,
  errors: number,
): RotatingCard | null {
  const cards: RotatingCard[] = []
  if (opts.enableFileSpotlight) cards.push("file-spotlight")
  if (opts.enableMissionBoard) cards.push("task-mission-board")
  // Warnings rotating card only participates when warnings are present and no errors
  if (hasWarnings && errors === 0) cards.push("diagnostics-warnings")
  cards.push("session-stats") // stats are always present as ultimate fallback

  if (cards.length === 0) return null
  return cards[index % cards.length]
}

export interface ActivityPayload {
  details: string
  state?: string
  assets?: {
    largeImageKey?: string
    largeImageText?: string
    smallImageKey?: string
    smallImageText?: string
  }
}

/**
 * Composes a Discord activity payload from a PresenceSnapshot.
 * Implements the locked precedence matrix and hybrid rotation policy.
 *
 * @param snapshot       - Current presence state
 * @param opts          - Rich presence feature flags and rotation interval
 * @param rotationIndex - Which informational card to show (0-based). Caller
 *                        should increment on each rotation tick.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: precedence dispatch inherently complex
export function getActivity(
  snapshot: PresenceSnapshot,
  opts: RichPresenceOptions,
  rotationIndex = 0,
): ActivityPayload {
  const {
    identity,
    idle,
    fileAction,
    todoSummary,
    diagnosticsSummary,
    sessionMetrics,
    recapCache,
  } = snapshot

  const agent = identity.agent ?? "OpenCode"
  const { errors, warnings } = diagnosticsSummary

  // ── 1. Session recap ─────────────────────────────────────────────────────
  if (recapCache && recapCache.timestamp != null) {
    const age = Date.now() - recapCache.timestamp
    if (age < RECAP_STALE_MS) {
      return {
        details: "Session Complete!",
        state: formatStatsLine({
          ...sessionMetrics,
          messageCount: recapCache.messageCount ?? sessionMetrics.messageCount,
          uniqueFilesTouched: new Set(recapCache.filesTouched ?? []),
          activeDurationSeconds:
            recapCache.activeDurationSeconds ?? sessionMetrics.activeDurationSeconds,
        }),
        assets: {
          largeImageKey: "state-recap",
          largeImageText: "Session Recap",
        },
      }
    }
  }

  // ── 2. Diagnostics-error ────────────────────────────────────────────────
  if (opts.diagnostics.errorsOnly && errors > 0) {
    return {
      details: `🔴 Working with ${agent}`,
      state: `${errors} error${errors !== 1 ? "s" : ""}, ${warnings} warning${warnings !== 1 ? "s" : ""}`,
      assets: {
        largeImageKey: "state-error",
        largeImageText: "Diagnostics",
      },
    }
  }

  // ── 3. Idle ─────────────────────────────────────────────────────────────
  if (idle) {
    const idleContext = todoSummary.activeTaskLabel
      ? `Last task: ${truncateTaskLabel(todoSummary.activeTaskLabel, MAX_STATE_LENGTH)}`
      : fileAction.file
        ? `Last file: ${formatFileLabel(fileAction.file)}`
        : sessionMetrics.sessionStartTimestamp
          ? `Session: ${formatDuration(sessionMetrics.activeDurationSeconds)}`
          : undefined

    return {
      details: `😴 ${agent} is idle`,
      state: idleContext,
      assets: {
        largeImageKey: "state-idle",
        largeImageText: "Idle",
      },
    }
  }

  // ── 4. All tasks complete ───────────────────────────────────────────────
  if (todoSummary.allDone && todoSummary.total > 0) {
    return {
      details: "All tasks complete!",
      state: `${todoSummary.completed}/${todoSummary.total} finished`,
      assets: {
        largeImageKey: "state-complete",
        largeImageText: "All Done",
      },
    }
  }

  // ── 5–8. Rotating informational cards ─────────────────────────────────
  const rotatingCard = resolveRotatingCard(rotationIndex, opts, warnings > 0, errors)

  // ── 5. File spotlight ────────────────────────────────────────────────────
  if (rotatingCard === "file-spotlight" && fileAction?.file) {
    // Derive operation label using the existing tool-label utility
    const toolInput: ToolLabelInput = {
      eventName: fileAction.action ? `tool.execute.${fileAction.action}` : undefined,
      toolName: fileAction.action,
    }
    const operation = fileAction.operation ?? getToolLabel(toolInput)
    const emoji = getOperationEmoji(operation)
    const fileLabel = formatFileLabel(fileAction.file)

    return {
      details: `${emoji} Working with ${agent}`,
      state: fileLabel,
      assets: {
        // Use the existing file-icons utility for language-based icons
        largeImageKey: getFileIconKey(fileAction.file, fileAction.language),
        largeImageText: operation,
      },
    }
  }

  // ── 6. Task mission board ────────────────────────────────────────────────
  if (rotatingCard === "task-mission-board" && todoSummary.total > 0) {
    return {
      details: `🎯 Working with ${agent}`,
      state: formatTaskLine(todoSummary),
      assets: {
        largeImageKey: "task",
        largeImageText: "Mission Board",
      },
    }
  }

  // ── 7. Diagnostics-warnings (rotating informational) ───────────────────
  // Only shown when warnings > 0 and errors = 0 (otherwise step 2 pins)
  if (rotatingCard === "diagnostics-warnings" && warnings > 0 && errors === 0) {
    return {
      details: `⚠️ Working with ${agent}`,
      state: `${warnings} warning${warnings !== 1 ? "s" : ""}`,
      assets: {
        largeImageKey: "state-warn",
        largeImageText: "Warnings",
      },
    }
  }

  // ── 8. Session stats (always available fallback) ─────────────────────────
  return {
    details: `📊 Working with ${agent}`,
    state: formatStatsLine(sessionMetrics),
    assets: {
      largeImageKey: "stats",
      largeImageText: "Session Stats",
    },
  }
}
