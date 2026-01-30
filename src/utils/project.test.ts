/**
 * @fileoverview Tests for project name detection
 */

import { describe, expect, test } from "bun:test"
import { getProjectName } from "./project"

describe("getProjectName", () => {
  describe("from Git remote URL", () => {
    test("extracts from SSH URL", () => {
      expect(getProjectName("git@github.com:user/my-repo.git")).toBe("my-repo")
      expect(getProjectName("git@gitlab.com:org/project-name.git")).toBe("project-name")
    })

    test("extracts from HTTPS URL", () => {
      expect(getProjectName("https://github.com/user/my-repo.git")).toBe("my-repo")
      expect(getProjectName("https://gitlab.com/org/project-name.git")).toBe("project-name")
    })

    test("handles URL without .git extension", () => {
      expect(getProjectName("https://github.com/user/my-repo")).toBe("my-repo")
    })
  })

  describe("from directory path", () => {
    test("extracts from Unix path", () => {
      expect(getProjectName(undefined, "/Users/dev/my-project")).toBe("my-project")
      expect(getProjectName(undefined, "/home/user/code/app")).toBe("app")
    })

    test("extracts from Windows path", () => {
      expect(getProjectName(undefined, "C:\\Users\\dev\\project")).toBe("project")
    })

    test("handles trailing slash", () => {
      expect(getProjectName(undefined, "/Users/dev/my-project/")).toBe("my-project")
    })
  })

  describe("fallback behavior", () => {
    test("returns Unknown Project when no info provided", () => {
      expect(getProjectName(undefined, undefined)).toBe("Unknown Project")
    })

    test("prefers Git URL over directory", () => {
      expect(getProjectName("git@github.com:user/from-git.git", "/path/to/from-dir")).toBe(
        "from-git",
      )
    })

    test("falls back to directory if Git URL parsing fails", () => {
      expect(getProjectName("invalid-url", "/path/to/fallback")).toBe("fallback")
    })
  })
})
