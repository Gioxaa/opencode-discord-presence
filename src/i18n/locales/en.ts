import type { Locale } from "./ko.js"

export const en: Locale = {
  code: "en",
  name: "English",

  presence: {
    active: (agent: string) => `Working with ${agent}`,
    idle: (agent: string) => `${agent} is idle`,
  },

  status: {
    opencode: "OpenCode",
    tokens: (count: string) => `${count} tokens`,
  },
}
