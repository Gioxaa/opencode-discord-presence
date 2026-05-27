# opencode-discord-presence

[![npm version](https://img.shields.io/npm/v/opencode-discord-presence.svg)](https://www.npmjs.com/package/opencode-discord-presence)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OpenCode 세션 상태를 Discord Rich Presence로 표시합니다. 현재 사용 중인 AI 에이전트, 모델, 세션 시간 등을 Discord에서 확인할 수 있습니다.

## 기능

- **실시간 에이전트 표시** - 현재 사용 중인 AI 에이전트 (Claude, Prometheus 등) 표시
- **모델 정보** - 활성 모델 표시 (Claude Sonnet, GPT-4 등)
- **세션 시간 추적** - 코딩 시간 표시
- **한국어 지원** - 한국어 조사 자동 처리 (을/를, 은/는)
- **유휴 감지** - 휴식 중일 때 자동으로 상태 변경

## 설치

```bash
# bun 사용
bun add opencode-discord-presence

# npm 사용
npm install opencode-discord-presence

# pnpm 사용
pnpm add opencode-discord-presence
```

## 빠른 시작

`opencode.json`에 플러그인을 추가하세요:

```json
{
  "plugins": ["opencode-discord-presence"]
}
```

끝! 플러그인이 자동으로 Discord에 연결되어 세션 상태를 표시합니다.

## 설정

홈 디렉토리 또는 프로젝트 루트에 `.discord-presence.json` 파일을 생성하세요:

```json
{
  "enabled": true,
  "applicationId": "YOUR_DISCORD_APP_ID",
  "language": "ko"
}
```

또는 환경변수를 사용할 수 있습니다:

```bash
OPENCODE_DISCORD_ENABLED=true
OPENCODE_DISCORD_CLIENT_ID=YOUR_APP_ID
OPENCODE_DISCORD_LANGUAGE=ko
OPENCODE_DISCORD_DEBUG=true
```

### 설정 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 플러그인 활성화/비활성화 |
| `applicationId` | `string` | (내장) | 커스텀 브랜딩을 위한 Discord Application ID |
| `language` | `string` | `"en"` | 표시 언어 (`"en"` 또는 `"ko"`) |
| `debug` | `boolean` | `false` | `[discord-presence]` 라이프사이클 로그(연결/해제/실패) 출력 여부. 기본값이 `false`라 OpenCode 콘솔에 아무것도 안 찍힙니다. |

### 설정 파일 우선순위

1. 프로젝트 디렉토리: `.discord-presence.json`
2. 홈 디렉토리: `~/.discord-presence.json`
3. 환경변수

## 커스텀 Discord Application

커스텀 브랜딩 (자신만의 이미지와 앱 이름)을 원한다면:

1. [Discord Developer Portal](https://discord.com/developers/applications)에 접속
2. "New Application" 클릭 후 이름 입력
3. "Rich Presence" → "Art Assets" 이동
4. 이미지 업로드 (최소 하나는 `opencode-logo`로 이름 지정)
5. "General Information"에서 Application ID 복사
6. 설정에 추가:

```json
{
  "discordPresence": {
    "applicationId": "YOUR_APPLICATION_ID"
  }
}
```

## 작동 방식

플러그인은 OpenCode의 이벤트 시스템에 연결됩니다:

- **chat.message** - 메시지 송수신 시 현재 에이전트와 모델을 추적하여 presence 업데이트
- **event** - 세션 상태 변경 (유휴, 활성) 감지

### Presence 상태

| 상태 | 영어 | 한국어 | 설명 |
|------|------|--------|------|
| 활성 | "Working with Prometheus" | "Prometheus를 갈구는중" | 에이전트로 활발히 코딩 중 |
| 유휴 | "Prometheus is idle" | "Prometheus는 휴식중" | 세션이 유휴 상태 |

한국어 조사 (을/를, 은/는)는 에이전트 이름의 받침 유무에 따라 자동으로 선택됩니다.

## 개발

```bash
# 의존성 설치
bun install

# 테스트 실행
bun test

# 테스트 watch 모드
bun test --watch

# 타입 체크
bun run typecheck

# 린트
bun run lint

# 포맷
bun run format

# 빌드
bun run build
```

## 아키텍처

```
src/
├── index.ts              # 메인 진입점 & exports
├── plugin.ts             # 핵심 플러그인 구현
├── config.ts             # 설정 관리
├── types/
│   └── index.ts          # TypeScript 타입 정의
├── services/
│   └── discord-rpc.ts    # Discord RPC 서비스 (싱글톤)
└── utils/
    └── particle.ts       # 한국어 조사 처리 (을/를, 은/는)
```

## 기여하기

기여를 환영합니다! 자세한 내용은 [Contributing Guide](CONTRIBUTING.md)를 참조하세요.

### 빠른 기여 가이드

1. 저장소 Fork
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 테스트 실행 (`bun test`)
4. 변경사항 커밋 (`git commit -m 'feat: add amazing feature'`)
5. 브랜치에 푸시 (`git push origin feature/amazing-feature`)
6. Pull Request 열기

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE)를 참조하세요.

## 관련 프로젝트

- [OpenCode](https://github.com/opencode-ai/opencode) - 이 플러그인이 확장하는 AI 코딩 어시스턴트
- [@xhayper/discord-rpc](https://github.com/xhayper/discord-rpc) - 이 플러그인에서 사용하는 Discord RPC 라이브러리

## 변경 이력

[CHANGELOG.md](CHANGELOG.md)에서 릴리스 이력을 확인하세요.
