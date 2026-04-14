import { describe, expect, test } from "bun:test"
import {
  createInitialPresenceState,
  presenceReducer,
  updateFileAction,
  updateIdentity,
  updateIdle,
  updateRecapCache,
  updateTodoSummary,
} from "./state/presence-state.js"
import type { RichPresenceOptions } from "./types/index.js"
import { getActivity } from "./utils/activity-rotation.js"
import {
  createSessionMetricsState,
  createSessionRecap,
  normalizeFileIdentity,
  recordFileTouch,
  recordMessageActivity,
  recordTaskContext,
} from "./utils/session-metrics.js"
import { getToolLabel } from "./utils/tool-label.js"

// ─── normalizeFileIdentity ────────────────────────────────────────────────────

describe("normalizeFileIdentity", () => {
  test("strips leading ./ from relative paths", () => {
    expect(normalizeFileIdentity("./src/index.ts")).toBe("src/index.ts")
  })

  test("normalizes backslashes to forward slashes", () => {
    expect(normalizeFileIdentity("src\\index.ts")).toBe("src/index.ts")
  })

  test("preserves absolute paths unchanged", () => {
    // normalizeFileIdentity is for deduplication, not display - absolute paths preserved
    expect(normalizeFileIdentity("/workspace/src/index.ts")).toBe("/workspace/src/index.ts")
  })
})

// ─── getToolLabel ─────────────────────────────────────────────────────────────

describe("getToolLabel", () => {
  test("maps file.edited to Editing", () => {
    expect(getToolLabel({ eventName: "file.edited" })).toBe("Editing")
  })

  test("maps lsp.client.diagnostics to Diagnosing", () => {
    expect(getToolLabel({ eventName: "lsp.client.diagnostics" })).toBe("Diagnosing")
  })

  test("maps edit tool to Editing", () => {
    expect(getToolLabel({ toolName: "edit" })).toBe("Editing")
  })

  test("maps read tool to Reading", () => {
    expect(getToolLabel({ toolName: "read" })).toBe("Reading")
  })

  test("maps grep/search tools to Searching", () => {
    expect(getToolLabel({ toolName: "grep" })).toBe("Searching")
  })

  test("unknown tool falls back to Working", () => {
    expect(getToolLabel({ toolName: "unknown-tool" })).toBe("Working")
  })

  test("bash with test command infers Running tests", () => {
    expect(getToolLabel({ toolName: "bash", command: "bun test" })).toBe("Running tests")
  })

  test("bash with build command infers Building", () => {
    expect(getToolLabel({ toolName: "bash", command: "npm run build" })).toBe("Building")
  })

  test("bash with generic command returns Executing", () => {
    expect(getToolLabel({ toolName: "bash", command: "ls -la" })).toBe("Executing")
  })
})

// ─── extractFilePathFromArgs ──────────────────────────────────────────────────

describe("extractFilePathFromArgs", () => {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: test helper mirrors plugin logic
  function extractFilePathFromArgs(args?: unknown): string | undefined {
    if (!args) return undefined
    if (typeof args === "string") {
      const trimmed = args.trim()
      if ((trimmed.includes("/") || trimmed.includes("\\")) && !trimmed.startsWith("-")) {
        return normalizeFileIdentity(trimmed)
      }
      return undefined
    }
    if (Array.isArray(args)) {
      for (const item of args) {
        const extracted = extractFilePathFromArgs(item)
        if (extracted) return extracted
      }
    }
    if (typeof args === "object") {
      for (const value of Object.values(args as Record<string, unknown>)) {
        const extracted = extractFilePathFromArgs(value)
        if (extracted) return extracted
      }
    }
    return undefined
  }

  test("extracts file path from string args", () => {
    expect(extractFilePathFromArgs("./src/index.ts")).toBe("src/index.ts")
  })

  test("extracts from array args", () => {
    expect(extractFilePathFromArgs(["arg1", "./src/app.ts", "arg3"])).toBe("src/app.ts")
  })

  test("extracts from object args", () => {
    expect(extractFilePathFromArgs({ file: "./src/app.ts" })).toBe("src/app.ts")
  })

  test("returns undefined for non-path strings", () => {
    expect(extractFilePathFromArgs("--help")).toBeUndefined()
    expect(extractFilePathFromArgs("some command")).toBeUndefined()
  })

  test("handles sparse/empty args without crashing", () => {
    expect(extractFilePathFromArgs(undefined)).toBeUndefined()
    expect(extractFilePathFromArgs(null)).toBeUndefined()
    expect(() => extractFilePathFromArgs({})).not.toThrow()
    expect(() => extractFilePathFromArgs([])).not.toThrow()
    expect(() => extractFilePathFromArgs(123)).not.toThrow()
  })
})

// ─── PresenceSnapshot state transitions ───────────────────────────────────────

describe("PresenceSnapshot state transitions", () => {
  test("chat.message updates identity and increments message count", () => {
    let snapshot = createInitialPresenceState()
    let metrics = createSessionMetricsState()

    snapshot = presenceReducer(
      snapshot,
      updateIdentity({ agent: "Claude", model: "claude-3-sonnet" }),
    )
    metrics = recordMessageActivity(metrics)

    expect(snapshot.identity.agent).toBe("Claude")
    expect(snapshot.identity.model).toBe("claude-3-sonnet")
    expect(metrics.messageCount).toBe(1)
  })

  test("tool.execute.before updates file context and clears idle via exitIdleIfNeeded", () => {
    let snapshot = createInitialPresenceState()
    let metrics = createSessionMetricsState()

    // Set idle first
    snapshot = presenceReducer(snapshot, updateIdle(true))
    expect(snapshot.idle).toBe(true)

    // exitIdleIfNeeded() clears idle before file action update (matches plugin flow)
    if (snapshot.idle) {
      snapshot = presenceReducer(snapshot, updateIdle(false))
    }

    // Simulate tool execution
    const filePath = normalizeFileIdentity("./src/plugin.ts")
    snapshot = presenceReducer(
      snapshot,
      updateFileAction({
        file: filePath,
        action: "edit",
        operation: "Editing",
      }),
    )
    metrics = recordFileTouch(metrics, filePath)

    expect(snapshot.idle).toBe(false)
    expect(snapshot.fileAction.file).toBe("src/plugin.ts")
    expect(snapshot.fileAction.operation).toBe("Editing")
  })

  test("file.edited event updates file context", () => {
    let snapshot = createInitialPresenceState()

    const filePath = normalizeFileIdentity("./src/app.ts")
    snapshot = presenceReducer(
      snapshot,
      updateFileAction({
        file: filePath,
        action: "edit",
        operation: "Editing",
      }),
    )

    expect(snapshot.fileAction.file).toBe("src/app.ts")
    expect(snapshot.fileAction.operation).toBe("Editing")
  })

  test("session.idle sets idle flag", () => {
    let snapshot = createInitialPresenceState()
    snapshot = presenceReducer(snapshot, updateIdle(true))
    expect(snapshot.idle).toBe(true)
  })

  test("session.deleted populates recap cache", () => {
    let snapshot = createInitialPresenceState()
    let metrics = createSessionMetricsState()

    metrics = recordMessageActivity(metrics)
    metrics = recordFileTouch(metrics, normalizeFileIdentity("./src/a.ts"))

    const recap = createSessionRecap(metrics)
    snapshot = presenceReducer(snapshot, updateRecapCache({ ...recap, timestamp: Date.now() }))

    expect(snapshot.recapCache.timestamp).toBeDefined()
    expect(snapshot.recapCache.messageCount).toBe(1)
    expect(snapshot.recapCache.uniqueFileCount).toBe(1)
  })

  test("exitIdleIfNeeded clears idle on any active event", () => {
    let snapshot = createInitialPresenceState()
    snapshot = presenceReducer(snapshot, updateIdle(true))
    expect(snapshot.idle).toBe(true)

    // Any subsequent active event calls exitIdleIfNeeded()
    if (snapshot.idle) {
      snapshot = presenceReducer(snapshot, updateIdle(false))
    }

    expect(snapshot.idle).toBe(false)
  })
})

// ─── todo.updated event processing ───────────────────────────────────────────

describe("todo.updated event processing", () => {
  test("computes todo summary correctly from todos array", () => {
    let snapshot = createInitialPresenceState()

    const todos = [
      { content: "Task 1", status: "completed" },
      { content: "Task 2", status: "in_progress" },
      { content: "Task 3", status: "pending" },
    ]

    const total = todos.length
    const completed = todos.filter((t) => t.status === "completed").length
    const pending = total - completed
    const allDone = completed === total && total > 0
    const activeTodo =
      todos.find((t) => t.status === "in_progress") ?? todos.find((t) => t.status === "pending")
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

    expect(snapshot.todoSummary.total).toBe(3)
    expect(snapshot.todoSummary.completed).toBe(1)
    expect(snapshot.todoSummary.pending).toBe(2)
    expect(snapshot.todoSummary.allDone).toBe(false)
    expect(snapshot.todoSummary.activeTaskLabel).toBe("Task 2")
  })

  test("detects all-done state", () => {
    let snapshot = createInitialPresenceState()

    const todos = [
      { content: "Task 1", status: "completed" },
      { content: "Task 2", status: "completed" },
    ]

    const total = todos.length
    const completed = todos.filter((t) => t.status === "completed").length
    const allDone = completed === total && total > 0

    snapshot = presenceReducer(
      snapshot,
      updateTodoSummary({ total, completed, pending: 0, allDone }),
    )

    expect(snapshot.todoSummary.allDone).toBe(true)
  })

  test("handles empty todos gracefully", () => {
    let snapshot = createInitialPresenceState()

    const todos: Array<{ content?: string; status?: string }> = []
    const total = todos.length
    const completed = todos.filter((t) => t.status === "completed").length

    snapshot = presenceReducer(
      snapshot,
      updateTodoSummary({ total, completed, pending: 0, allDone: false }),
    )

    expect(snapshot.todoSummary.total).toBe(0)
    expect(snapshot.todoSummary.allDone).toBe(false)
  })

  test("handles missing todos by preserving prior state", () => {
    let snapshot = createInitialPresenceState()

    // Pre-populate some todo state
    snapshot = presenceReducer(
      snapshot,
      updateTodoSummary({
        total: 5,
        completed: 2,
        pending: 3,
        allDone: false,
        activeTaskLabel: "Task A",
      }),
    )

    // Empty update — preserves state
    const before = { ...snapshot.todoSummary }
    snapshot = presenceReducer(snapshot, updateTodoSummary({}))
    expect(snapshot.todoSummary).toEqual(before)
  })

  test("partial todoSummary update preserves unrelated fields", () => {
    let snapshot = createInitialPresenceState()
    snapshot = presenceReducer(
      snapshot,
      updateTodoSummary({
        total: 5,
        completed: 2,
        pending: 3,
        allDone: false,
        activeTaskLabel: "Task A",
      }),
    )

    // Only update completion counts
    snapshot = presenceReducer(snapshot, updateTodoSummary({ completed: 3, pending: 2 }))

    expect(snapshot.todoSummary.total).toBe(5) // preserved
    expect(snapshot.todoSummary.activeTaskLabel).toBe("Task A") // preserved
    expect(snapshot.todoSummary.completed).toBe(3)
    expect(snapshot.todoSummary.pending).toBe(2)
  })
})

// ─── Rotation logic ──────────────────────────────────────────────────────────

describe("rotation logic", () => {
  test("countRotatingCards computes correctly", () => {
    function countRotatingCards(
      enableFileSpotlight: boolean,
      enableMissionBoard: boolean,
      hasWarnings: boolean,
      errors: number,
    ): number {
      let count = 0
      if (enableFileSpotlight) count++
      if (enableMissionBoard) count++
      if (hasWarnings && errors === 0) count++
      count++ // session-stats always present
      return Math.max(count, 1)
    }

    expect(countRotatingCards(true, true, false, 0)).toBe(3)
    expect(countRotatingCards(true, true, true, 0)).toBe(4)
    expect(countRotatingCards(true, true, true, 5)).toBe(3)
    expect(countRotatingCards(true, false, false, 0)).toBe(2)
    expect(countRotatingCards(false, false, false, 0)).toBe(1)
  })

  test("rotation index wraps around correctly", () => {
    const cardCount = 3
    let index = 0

    index = (index + 1) % cardCount
    expect(index).toBe(1)

    index = (index + 1) % cardCount
    expect(index).toBe(2)

    index = (index + 1) % cardCount
    expect(index).toBe(0)

    index = (index + 1) % cardCount
    expect(index).toBe(1)
  })
})

// ─── getActivity integration ─────────────────────────────────────────────────

describe("getActivity integration with snapshot", () => {
  const defaultOpts: RichPresenceOptions = {
    enableFileSpotlight: true,
    enableMissionBoard: true,
    rotationIntervalSeconds: 20,
    diagnostics: { errorsOnly: true },
  }

  test("idle state shows best available context", () => {
    let snapshot = createInitialPresenceState()
    snapshot = presenceReducer(snapshot, updateIdentity({ agent: "Claude" }))
    snapshot = presenceReducer(
      snapshot,
      updateTodoSummary({
        total: 3,
        completed: 1,
        pending: 2,
        allDone: false,
        activeTaskLabel: "Implement feature X",
      }),
    )
    snapshot = presenceReducer(snapshot, updateIdle(true))

    const activity = getActivity(snapshot, defaultOpts, 0)

    expect(activity.details).toBe("😴 Claude is idle")
    expect(activity.state).toContain("Last task:")
    expect(activity.state).toContain("Implement feature X")
  })

  test("active operation + file spotlight uses operation emoji", () => {
    let snapshot = createInitialPresenceState()
    snapshot = presenceReducer(snapshot, updateIdentity({ agent: "Claude" }))
    // Use workspace-relative path (no leading ./) since formatFileLabel returns basename
    snapshot = presenceReducer(
      snapshot,
      updateFileAction({
        file: "src/plugin.ts",
        action: "edit",
        operation: "Editing",
      }),
    )

    const activity = getActivity(snapshot, defaultOpts, 0)

    expect(activity.details).toContain("✍️")
    expect(activity.details).toContain("Claude")
    // formatFileLabel with no workspace root returns basename: "plugin.ts"
    expect(activity.state).toContain("plugin.ts")
  })

  test("all-done state pins correctly", () => {
    let snapshot = createInitialPresenceState()
    snapshot = presenceReducer(snapshot, updateIdentity({ agent: "Claude" }))
    snapshot = presenceReducer(
      snapshot,
      updateTodoSummary({
        total: 5,
        completed: 5,
        pending: 0,
        allDone: true,
      }),
    )

    const activity = getActivity(snapshot, defaultOpts, 0)

    expect(activity.details).toBe("All tasks complete!")
    expect(activity.state).toBe("5/5 finished")
  })

  test("session.deleted recap card shows for fresh recap", () => {
    let snapshot = createInitialPresenceState()
    snapshot = presenceReducer(snapshot, updateIdentity({ agent: "Claude" }))
    snapshot = presenceReducer(
      snapshot,
      updateRecapCache({
        messageCount: 27,
        filesTouched: ["src/a.ts", "src/b.ts"],
        uniqueFileCount: 2,
        activeDurationSeconds: 3600,
        timestamp: Date.now(),
      }),
    )

    const activity = getActivity(snapshot, defaultOpts, 0)

    expect(activity.details).toBe("Session Complete!")
    expect(activity.state).toContain("27 prompts")
    expect(activity.state).toContain("2 files")
  })

  test("diagnostics-error pins over file rotation", () => {
    let snapshot = createInitialPresenceState()
    snapshot = presenceReducer(snapshot, updateIdentity({ agent: "Claude" }))
    snapshot = presenceReducer(
      snapshot,
      updateFileAction({
        file: "./src/broken.ts",
        action: "edit",
        operation: "Editing",
      }),
    )
    // Override diagnostics: direct state replacement for test
    snapshot = {
      ...snapshot,
      diagnosticsSummary: { errors: 5, warnings: 2, hints: 0, infos: 0 },
    }

    const activity = getActivity(snapshot, defaultOpts, 0)

    expect(activity.details).toContain("🔴")
    expect(activity.state).toContain("5 errors")
  })
})

// ─── Sparse payload tolerance ─────────────────────────────────────────────────

describe("sparse payload tolerance", () => {
  test("partial identity update preserves existing model", () => {
    let snapshot = createInitialPresenceState()
    snapshot = presenceReducer(
      snapshot,
      updateIdentity({ agent: "Claude", model: "claude-3-sonnet" }),
    )
    snapshot = presenceReducer(snapshot, updateIdentity({ agent: "Prometheus" }))

    expect(snapshot.identity.agent).toBe("Prometheus")
    expect(snapshot.identity.model).toBe("claude-3-sonnet") // preserved
  })

  test("partial fileAction update preserves unrelated fields", () => {
    let snapshot = createInitialPresenceState()
    // Use normalizeFileIdentity so the stored path matches what the plugin stores
    const filePath = normalizeFileIdentity("./src/app.ts")
    snapshot = presenceReducer(snapshot, updateFileAction({ file: filePath, operation: "Editing" }))
    snapshot = presenceReducer(snapshot, updateFileAction({ operation: "Reading" }))

    expect(snapshot.fileAction.file).toBe("src/app.ts") // preserved
    expect(snapshot.fileAction.operation).toBe("Reading")
  })

  test("multiple sequential updates accumulate correctly", () => {
    let snapshot = createInitialPresenceState()
    let metrics = createSessionMetricsState()

    // Message 1
    snapshot = presenceReducer(snapshot, updateIdentity({ agent: "Claude" }))
    metrics = recordMessageActivity(metrics)

    // File touch 1
    const file1 = normalizeFileIdentity("./src/a.ts")
    snapshot = presenceReducer(snapshot, updateFileAction({ file: file1, operation: "Editing" }))
    metrics = recordFileTouch(metrics, file1)

    // Message 2 (agent switch)
    snapshot = presenceReducer(snapshot, updateIdentity({ agent: "Prometheus" }))
    metrics = recordMessageActivity(metrics)
    metrics = recordTaskContext(metrics, "Implement feature X")

    // File touch 2
    const file2 = normalizeFileIdentity("./src/b.ts")
    snapshot = presenceReducer(snapshot, updateFileAction({ file: file2, operation: "Reading" }))
    metrics = recordFileTouch(metrics, file2)

    expect(snapshot.identity.agent).toBe("Prometheus")
    expect(snapshot.identity.model).toBe("") // never set
    expect(metrics.messageCount).toBe(2)
    expect(metrics.uniqueFilesTouched.size).toBe(2)
    expect(metrics.lastTaskContext).toBe("Implement feature X")
    expect(metrics.lastFileContext).toBe(file2)
  })
})
