import type { Locale } from "./ko.js"

export const zh: Locale = {
  code: "zh",
  name: "中文",

  presence: {
    active: (agent: string) => `正在使用 ${agent}`,
    idle: (agent: string) => `${agent} 休息中`,
  },

  status: {
    opencode: "OpenCode",
    tokens: (count: string) => `${count} 令牌`,
  },
}
