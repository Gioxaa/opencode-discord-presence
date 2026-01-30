import { withParticle } from "../../utils/particle"

export interface Locale {
  code: string
  name: string
  presence: {
    active: (agent: string) => string
    idle: (agent: string) => string
  }
  status: {
    opencode: string
    tokens: (count: string) => string
  }
}

export const ko: Locale = {
  code: "ko",
  name: "한국어",

  presence: {
    active: (agent: string) => `${withParticle(agent, "을/를")} 갈구는중`,
    idle: (agent: string) => `${withParticle(agent, "은/는")} 휴식중`,
  },

  status: {
    opencode: "OpenCode",
    tokens: (count: string) => `${count} 토큰`,
  },
}
