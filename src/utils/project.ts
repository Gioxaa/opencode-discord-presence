/**
 * @fileoverview Project name detection utility
 * @module opencode-discord-presence/utils/project
 *
 * Detects the current project name from Git remote URL or directory name.
 */

/**
 * Extract project name from a Git remote URL
 *
 * @param remoteUrl - Git remote URL (SSH or HTTPS format)
 * @returns Repository name without .git extension, or null if parsing fails
 *
 * @example
 * ```typescript
 * parseGitUrl("git@github.com:user/my-repo.git")     // "my-repo"
 * parseGitUrl("https://github.com/user/my-repo.git") // "my-repo"
 * parseGitUrl("https://github.com/user/my-repo")     // "my-repo"
 * ```
 */
function parseGitUrl(remoteUrl: string): string | null {
  // SSH format: git@github.com:user/repo.git
  const sshMatch = remoteUrl.match(/git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (sshMatch) {
    return sshMatch[2]
  }

  // HTTPS format: https://github.com/user/repo.git
  const httpsMatch = remoteUrl.match(/https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (httpsMatch) {
    return httpsMatch[2]
  }

  return null
}

/**
 * Extract directory name from a path
 *
 * @param path - Full directory path
 * @returns Last component of the path
 */
function getDirectoryName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] || "Unknown Project"
}

/**
 * Get the project name from Git remote URL or directory path
 *
 * Priority:
 * 1. Git remote URL (if provided) - extracts repo name
 * 2. Directory path (if provided) - extracts folder name
 * 3. Fallback - "Unknown Project"
 *
 * @param remoteUrl - Git remote URL (optional)
 * @param directory - Current working directory path (optional)
 * @returns Project name
 *
 * @example
 * ```typescript
 * getProjectName("git@github.com:user/my-repo.git")
 * // "my-repo"
 *
 * getProjectName(undefined, "/Users/dev/my-project")
 * // "my-project"
 *
 * getProjectName(undefined, undefined)
 * // "Unknown Project"
 * ```
 */
export function getProjectName(remoteUrl?: string, directory?: string): string {
  // Try Git remote URL first
  if (remoteUrl) {
    const repoName = parseGitUrl(remoteUrl)
    if (repoName) {
      return repoName
    }
  }

  // Fall back to directory name
  if (directory) {
    return getDirectoryName(directory)
  }

  return "Unknown Project"
}
