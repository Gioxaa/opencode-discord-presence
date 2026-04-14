import { describe, expect, test } from "bun:test"
import type { PresenceSnapshot } from "../state/presence-state"
import { createInitialPresenceState } from "../state/presence-state"
import type { RichPresenceOptions } from "../types/index.js"
import { getActivity, resolveRotatingCard } from "./activity-rotation"

function makeState(overrides: Partial<PresenceSnapshot> = {}): PresenceSnapshot {
  const base = createInitialPresenceState()
  return {
    ...base,
    identity: { agent: "Claude", model: "claude-sonnet-4-20250501" },
    sessionMetrics: {
      ...base.sessionMetrics,
      messageCount: 10,
      uniqueFilesTouched: new Set(["src/plugin.ts", "src/utils/file-label.ts"]),
      activeDurationSeconds: 3600,
      lastActivityTimestamp: Date.now(),
    },
    ...overrides,
  }
}

function defaultOpts(): RichPresenceOptions {
  return {
    enableFileSpotlight: true,
    enableMissionBoard: true,
    rotationIntervalSeconds: 20,
    diagnostics: { errorsOnly: true },
  }
}

describe("getActivity — precedence", () => {
  test("recap pins over diagnostics, idle, and all-done", () => {
    const state = makeState({
      recapCache: {
        messageCount: 5,
        uniqueFileCount: 3,
        activeDurationSeconds: 600,
        timestamp: Date.now(),
      },
      diagnosticsSummary: { errors: 3, warnings: 1, hints: 0, infos: 0 },
      idle: true,
      todoSummary: { total: 5, completed: 5, pending: 0, allDone: true },
    })

    const activity = getActivity(state, defaultOpts())

    expect(activity.details).toContain("Session Complete")
  })

  test("diagnostics-error pins over idle and all-done when errors > 0", () => {
    const state = makeState({
      recapCache: {},
      diagnosticsSummary: { errors: 2, warnings: 5, hints: 0, infos: 0 },
      idle: true,
      todoSummary: { total: 5, completed: 5, pending: 0, allDone: true },
    })

    const activity = getActivity(state, defaultOpts())

    expect(activity.details).toContain("Working with Claude")
    expect(activity.state).toMatch(/\d+ errors?/)
  })

  test("idle pins over all-done", () => {
    const state = makeState({
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      idle: true,
      todoSummary: { total: 5, completed: 5, pending: 0, allDone: true },
    })

    const activity = getActivity(state, defaultOpts())

    expect(activity.details).toContain("Claude is idle")
  })

  test("all-done pins over file/task rotation", () => {
    const state = makeState({
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      idle: false,
      todoSummary: { total: 3, completed: 3, pending: 0, allDone: true },
      fileAction: { file: "src/utils/activity-rotation.ts", action: "edit" },
    })

    const activity = getActivity(state, defaultOpts())

    expect(activity.details).toContain("All tasks complete")
  })

  test("warnings alone do NOT pin — they stay in rotation", () => {
    const state = makeState({
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 5, hints: 0, infos: 0 },
      idle: false,
      todoSummary: { total: 3, completed: 1, pending: 2, allDone: false },
      fileAction: {
        file: "D:/coding_clone/opencode-discord-presence/src/utils/activity-rotation.ts",
        action: "edit",
      },
    })

    const activity = getActivity(state, defaultOpts())

    // Should NOT be diagnostics pinned — errors is 0
    expect(activity.state).not.toMatch(/\d+ errors?/)
    // Should be the rotating file card showing the file
    expect(activity.state).toContain("activity-rotation.ts")
  })
})

describe("getActivity — rotation (no critical state)", () => {
  function makeRotatingState(
    fileAction?: { file: string; action: string; operation?: string },
    todoSummary?: Partial<PresenceSnapshot["todoSummary"]>,
    diagnosticsSummary: PresenceSnapshot["diagnosticsSummary"] = {
      errors: 0,
      warnings: 0,
      hints: 0,
      infos: 0,
    },
  ) {
    return makeState({
      recapCache: {},
      diagnosticsSummary,
      idle: false,
      todoSummary: {
        total: 5,
        completed: 2,
        pending: 3,
        allDone: false,
        ...todoSummary,
      },
      fileAction: fileAction ?? { file: "src/plugin.ts", action: "edit" },
    })
  }

  test("rotates file → task → stats in order on successive ticks (no warnings)", () => {
    const state = makeRotatingState(
      {
        file: "D:/coding_clone/opencode-discord-presence/src/utils/activity-rotation.ts",
        action: "edit",
        operation: "Editing",
      },
      {
        total: 5,
        completed: 2,
        pending: 3,
        allDone: false,
        activeTaskLabel: "Implement rotation",
      },
      { errors: 0, warnings: 0, hints: 0, infos: 0 },
    )
    const opts = defaultOpts()

    // index 0 → file spotlight
    const act0 = getActivity(state, opts, 0)
    expect(act0.details).toContain("Working with Claude")
    expect(act0.state).toContain("activity-rotation.ts")

    // index 1 → task mission board
    const act1 = getActivity(state, opts, 1)
    expect(act1.details).toContain("Working with Claude")
    expect(act1.state).toMatch(/Implement rotation/)

    // index 2 → session stats
    const act2 = getActivity(state, opts, 2)
    expect(act2.details).toContain("Working with Claude")
    expect(act2.state).toMatch(/\d+ prompts/)
  })

  test("warnings-only rotates: file → task → warnings → stats (4 cards)", () => {
    const state = makeRotatingState(
      {
        file: "D:/coding_clone/opencode-discord-presence/src/utils/activity-rotation.ts",
        action: "edit",
        operation: "Editing",
      },
      {
        total: 5,
        completed: 2,
        pending: 3,
        allDone: false,
        activeTaskLabel: "Implement rotation",
      },
      { errors: 0, warnings: 3, hints: 0, infos: 0 },
    )
    const opts = defaultOpts()

    // index 0 → file
    const act0 = getActivity(state, opts, 0)
    expect(act0.state).toContain("activity-rotation.ts")

    // index 1 → task
    const act1 = getActivity(state, opts, 1)
    expect(act1.state).toMatch(/Implement rotation/)

    // index 2 → warnings card (only when warnings > 0 && errors === 0)
    const act2 = getActivity(state, opts, 2)
    expect(act2.details).toContain("Working with Claude")
    expect(act2.state).toMatch(/3 warnings/)
    expect(act2.details).toContain("⚠️")

    // index 3 → stats
    const act3 = getActivity(state, opts, 3)
    expect(act3.state).toMatch(/\d+ prompts/)
  })

  test("warnings card does NOT appear when errors > 0 (diagnostics pins instead)", () => {
    const state = makeRotatingState(
      {
        file: "D:/coding_clone/opencode-discord-presence/src/utils/activity-rotation.ts",
        action: "edit",
      },
      {
        total: 5,
        completed: 2,
        pending: 3,
        allDone: false,
        activeTaskLabel: "Implement rotation",
      },
      { errors: 2, warnings: 3, hints: 0, infos: 0 },
    )
    const opts = defaultOpts()

    // Even at rotation index 2 (which would be warnings if it were active),
    // diagnostics-error takes precedence since errors > 0
    const act2 = getActivity(state, opts, 2)
    expect(act2.state).toMatch(/\d+ errors?/)
    expect(act2.details).toContain("🔴")
  })

  test("file spotlight disabled → skips to task or stats (or warnings)", () => {
    const state = makeRotatingState(
      {
        file: "D:/coding_clone/opencode-discord-presence/src/utils/activity-rotation.ts",
        action: "edit",
        operation: "Editing",
      },
      {
        total: 5,
        completed: 2,
        pending: 3,
        allDone: false,
        activeTaskLabel: "Implement rotation",
      },
      { errors: 0, warnings: 2, hints: 0, infos: 0 },
    )
    const opts = { ...defaultOpts(), enableFileSpotlight: false }

    // index 0 → task (file disabled)
    const act0 = getActivity(state, opts, 0)
    expect(act0.state).toMatch(/Implement rotation/)

    // index 1 → warnings (file disabled, task→warnings→stats)
    const act1 = getActivity(state, opts, 1)
    expect(act1.state).toMatch(/2 warnings/)

    // index 2 → stats
    const act2 = getActivity(state, opts, 2)
    expect(act2.state).toMatch(/\d+ prompts/)
  })

  test("mission board disabled → file → stats (warnings still rotates if applicable)", () => {
    const state = makeRotatingState(
      {
        file: "D:/coding_clone/opencode-discord-presence/src/utils/activity-rotation.ts",
        action: "edit",
        operation: "Editing",
      },
      { total: 0, completed: 0, pending: 0, allDone: false },
      { errors: 0, warnings: 2, hints: 0, infos: 0 },
    )
    const opts = { ...defaultOpts(), enableMissionBoard: false }

    // index 0 → file
    const act0 = getActivity(state, opts, 0)
    expect(act0.state).toContain("activity-rotation.ts")

    // index 1 → warnings
    const act1 = getActivity(state, opts, 1)
    expect(act1.state).toMatch(/2 warnings/)

    // index 2 → stats
    const act2 = getActivity(state, opts, 2)
    expect(act2.state).toMatch(/\d+ prompts/)
  })

  test("both file and mission disabled → warnings → stats", () => {
    const state = makeRotatingState(
      { file: "src/utils/activity-rotation.ts", action: "edit" },
      { total: 0, completed: 0, pending: 0, allDone: false },
      { errors: 0, warnings: 4, hints: 0, infos: 0 },
    )
    const opts = {
      ...defaultOpts(),
      enableFileSpotlight: false,
      enableMissionBoard: false,
    }

    // index 0 → warnings
    const act0 = getActivity(state, opts, 0)
    expect(act0.state).toMatch(/4 warnings/)

    // index 1 → stats
    const act1 = getActivity(state, opts, 1)
    expect(act1.state).toMatch(/\d+ prompts/)
  })

  test("wraps rotation index back to 0 after last card", () => {
    const state = makeRotatingState(
      {
        file: "src/utils/activity-rotation.ts",
        action: "edit",
        operation: "Editing",
      },
      {
        total: 5,
        completed: 2,
        pending: 3,
        allDone: false,
        activeTaskLabel: "Implement rotation",
      },
      { errors: 0, warnings: 0, hints: 0, infos: 0 },
    )
    const opts = defaultOpts()

    const act0 = getActivity(state, opts, 0)
    const act3 = getActivity(state, opts, 3) // wraps to 0

    expect(act0.state).toBe(act3.state)
  })
})

describe("getActivity — operation-specific file spotlight emoji", () => {
  const baseOpts = defaultOpts()

  test("editing uses ✍️ emoji", () => {
    const state = makeState({
      idle: false,
      fileAction: {
        file: "src/utils/activity-rotation.ts",
        action: "edit",
        operation: "Editing",
      },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      todoSummary: { total: 0, completed: 0, pending: 0, allDone: false },
    })

    const activity = getActivity(state, baseOpts, 0)
    expect(activity.details).toBe("✍️ Working with Claude")
  })

  test("reading uses 📖 emoji", () => {
    const state = makeState({
      idle: false,
      fileAction: {
        file: "src/utils/activity-rotation.ts",
        action: "read",
        operation: "Reading",
      },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      todoSummary: { total: 0, completed: 0, pending: 0, allDone: false },
    })

    const activity = getActivity(state, baseOpts, 0)
    expect(activity.details).toBe("📖 Working with Claude")
  })

  test("searching uses 🔍 emoji", () => {
    const state = makeState({
      idle: false,
      fileAction: {
        file: "src/utils/activity-rotation.ts",
        action: "grep",
        operation: "Searching",
      },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      todoSummary: { total: 0, completed: 0, pending: 0, allDone: false },
    })

    const activity = getActivity(state, baseOpts, 0)
    expect(activity.details).toBe("🔍 Working with Claude")
  })

  test("running tests uses 🧪 emoji", () => {
    const state = makeState({
      idle: false,
      fileAction: {
        file: "src/utils/activity-rotation.ts",
        action: "bash",
        operation: "Running tests",
      },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      todoSummary: { total: 0, completed: 0, pending: 0, allDone: false },
    })

    const activity = getActivity(state, baseOpts, 0)
    expect(activity.details).toBe("🧪 Working with Claude")
  })

  test("building uses 🔨 emoji", () => {
    const state = makeState({
      idle: false,
      fileAction: {
        file: "src/utils/activity-rotation.ts",
        action: "bash",
        operation: "Building",
      },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      todoSummary: { total: 0, completed: 0, pending: 0, allDone: false },
    })

    const activity = getActivity(state, baseOpts, 0)
    expect(activity.details).toBe("🔨 Working with Claude")
  })

  test("diagnosing uses 🩺 emoji", () => {
    const state = makeState({
      idle: false,
      fileAction: {
        file: "src/utils/activity-rotation.ts",
        action: "diagnose",
        operation: "Diagnosing",
      },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      todoSummary: { total: 0, completed: 0, pending: 0, allDone: false },
    })

    const activity = getActivity(state, baseOpts, 0)
    expect(activity.details).toBe("🩺 Working with Claude")
  })

  test("operation falls back to getToolLabel when operation is not explicitly set", () => {
    // When fileAction.operation is absent, getToolLabel is called with eventName derived from action
    const state = makeState({
      idle: false,
      fileAction: {
        file: "src/utils/activity-rotation.ts",
        action: "read" /* no operation */,
      },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      todoSummary: { total: 0, completed: 0, pending: 0, allDone: false },
    })

    const activity = getActivity(state, baseOpts, 0)
    // getToolLabel({ eventName: "tool.execute.read" }) → "Reading" → 📖
    expect(activity.details).toBe("📖 Working with Claude")
  })
})

describe("getActivity — file-icons integration", () => {
  test("file spotlight uses getFileIconKey for language-based icons", () => {
    const state = makeState({
      idle: false,
      fileAction: {
        file: "src/utils/activity-rotation.ts",
        action: "edit",
        operation: "Editing",
        language: "typescript",
      },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      todoSummary: { total: 0, completed: 0, pending: 0, allDone: false },
    })

    const activity = getActivity(state, defaultOpts(), 0)
    // getFileIconKey("src/utils/activity-rotation.ts", "typescript") → "typescript"
    expect(activity.assets?.largeImageKey).toBe("typescript")
  })

  test("file spotlight falls back to extension-based icon", () => {
    const state = makeState({
      idle: false,
      fileAction: {
        file: "README.md",
        action: "read",
        operation: "Reading",
        // no language — should use extension map
      },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      todoSummary: { total: 0, completed: 0, pending: 0, allDone: false },
    })

    const activity = getActivity(state, defaultOpts(), 0)
    // getFileIconKey("README.md") → "markdown"
    expect(activity.assets?.largeImageKey).toBe("markdown")
  })
})

describe("getActivity — headline preservation", () => {
  test("idle headline uses '😴 Claude is idle' style", () => {
    const state = makeState({
      idle: true,
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
    })

    const activity = getActivity(state, defaultOpts())

    expect(activity.details).toBe("😴 Claude is idle")
  })

  test("session recap uses dedicated 'Session Complete!' headline", () => {
    const state = makeState({
      recapCache: {
        messageCount: 27,
        uniqueFileCount: 3,
        activeDurationSeconds: 3720,
        timestamp: Date.now(),
      },
      idle: false,
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
    })

    const activity = getActivity(state, defaultOpts())

    expect(activity.details).toBe("Session Complete!")
  })

  test("all-done uses dedicated 'All tasks complete!' headline", () => {
    const state = makeState({
      idle: false,
      todoSummary: { total: 5, completed: 5, pending: 0, allDone: true },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
    })

    const activity = getActivity(state, defaultOpts())

    expect(activity.details).toBe("All tasks complete!")
  })
})

describe("getActivity — truncation safety", () => {
  test("long file labels are truncated before being placed in state", () => {
    const veryLongPath = `D:/coding_clone/opencode-discord-presence/src/features/presence/components/activity-rotation.test.ts`
    const state = makeState({
      idle: false,
      fileAction: { file: veryLongPath, action: "edit", operation: "Editing" },
      recapCache: {},
      diagnosticsSummary: { errors: 0, warnings: 0, hints: 0, infos: 0 },
      todoSummary: { total: 0, completed: 0, pending: 0, allDone: false },
    })

    const activity = getActivity(state, defaultOpts(), 0)

    // State line must not exceed 42 chars (MAX_STATE_LENGTH)
    expect(activity.state?.length ?? 0).toBeLessThanOrEqual(42)
  })
})

describe("resolveRotatingCard", () => {
  const opts: RichPresenceOptions = {
    enableFileSpotlight: true,
    enableMissionBoard: true,
    rotationIntervalSeconds: 20,
    diagnostics: { errorsOnly: true },
  }

  test("returns file-spotlight, task, session-stats in order when no warnings", () => {
    expect(resolveRotatingCard(0, opts, false, 0)).toBe("file-spotlight")
    expect(resolveRotatingCard(1, opts, false, 0)).toBe("task-mission-board")
    expect(resolveRotatingCard(2, opts, false, 0)).toBe("session-stats")
    expect(resolveRotatingCard(3, opts, false, 0)).toBe("file-spotlight") // wraps
  })

  test("includes diagnostics-warnings card when warnings > 0 && errors = 0", () => {
    // Order: file-spotlight → task-mission-board → diagnostics-warnings → session-stats
    expect(resolveRotatingCard(0, opts, true, 0)).toBe("file-spotlight")
    expect(resolveRotatingCard(1, opts, true, 0)).toBe("task-mission-board")
    expect(resolveRotatingCard(2, opts, true, 0)).toBe("diagnostics-warnings")
    expect(resolveRotatingCard(3, opts, true, 0)).toBe("session-stats")
    expect(resolveRotatingCard(4, opts, true, 0)).toBe("file-spotlight") // wraps
  })

  test("excludes diagnostics-warnings when errors > 0 (diagnostics pins instead)", () => {
    // Even though hasWarnings=true, errors>0 means diagnostics pins — warnings card excluded
    expect(resolveRotatingCard(0, opts, true, 2)).toBe("file-spotlight")
    expect(resolveRotatingCard(1, opts, true, 2)).toBe("task-mission-board")
    expect(resolveRotatingCard(2, opts, true, 2)).toBe("session-stats") // no warnings card
  })

  test("excludes diagnostics-warnings when hasWarnings=false", () => {
    expect(resolveRotatingCard(0, opts, false, 0)).toBe("file-spotlight")
    expect(resolveRotatingCard(1, opts, false, 0)).toBe("task-mission-board")
    expect(resolveRotatingCard(2, opts, false, 0)).toBe("session-stats") // no warnings card
  })

  test("file disabled → task → warnings → stats", () => {
    const optsNoFile: RichPresenceOptions = {
      ...opts,
      enableFileSpotlight: false,
    }
    expect(resolveRotatingCard(0, optsNoFile, true, 0)).toBe("task-mission-board")
    expect(resolveRotatingCard(1, optsNoFile, true, 0)).toBe("diagnostics-warnings")
    expect(resolveRotatingCard(2, optsNoFile, true, 0)).toBe("session-stats")
  })

  test("both disabled → warnings → stats (warnings still rotates)", () => {
    const optsNone: RichPresenceOptions = {
      ...opts,
      enableFileSpotlight: false,
      enableMissionBoard: false,
    }
    // Warnings card still appears since it precedes stats in rotation order
    expect(resolveRotatingCard(0, optsNone, true, 0)).toBe("diagnostics-warnings")
    expect(resolveRotatingCard(1, optsNone, true, 0)).toBe("session-stats")
  })
})
