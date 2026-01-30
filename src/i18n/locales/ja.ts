import type { Locale } from "./ko.js"

export const ja: Locale = {
  code: "ja",
  name: "日本語",

  presence: {
    active: (agent: string) => `${agent}で作業中`,
    idle: (agent: string) => `${agent}は休憩中`,
  },

  status: {
    opencode: "OpenCode",
    tokens: (count: string) => `${count}トークン`,
  },
}
