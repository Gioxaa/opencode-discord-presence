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
- **라이브 파일 스포트라이트** - 에이전트가 편집, 읽기, 진단 중인 파일을 언어별 Discord 아이콘과 함께 표시
- **태스크 미션 보드** - 활성 태스크 레이블과 완료 카운트 (예: "다크 모드 구현 중 (2/5)")로 진행 상황 표시
- ** Diagnostics 인식 presence** - LSP diagnostics가 있을 때 자동으로 오류/경고 카운트 표시 (see [제한사항](#제한사항))
- **스마트 로테이션** - 심각한 상태 (오류, 유휴, 모두 완료)는 고정; 정보성 카드 (파일 스포트라이트, 미션 보드, 세션 통계)는 기본 20초마다 순환
- **세션 되돌아보기** - 세션이 종료되면 30초 동안 총 프롬프트 수, 수정된 파일 수, 활성 기간을 표시

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
```

### 설정 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 플러그인 활성화/비활성화 |
| `applicationId` | `string` | (내장) | 커스텀 브랜딩을 위한 Discord Application ID |
| `language` | `string` | `"en"` | 표시 언어 (`"en"` 또는 `"ko"`) |
| `richPresence.enableFileSpotlight` | `boolean` | `true` | 라이브 파일 스포트라이트 카드 표시 |
| `richPresence.enableMissionBoard` | `boolean` | `true` | 태스크 미션 보드 카드 표시 |
| `richPresence.rotationIntervalSeconds` | `number` | `20` | 정보성 카드 순환 주기 (10–60초) |
| `richPresence.diagnostics.errorsOnly` | `boolean` | `true` | 오류 diagnostics 고정; 경고는 순환에 표시 |

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
- **tool.execute.before** / **tool.execute.after** - 파일 컨텍스트 및 도구 작업 레이블 캡처 (편집, 읽기, 검색, 빌드, 테스트 등)
- **file.edited** - 편집된 파일 경로와 언어 아이콘으로 라이브 파일 스포트라이트 업데이트
- **todo.updated** - 활성 태스크 레이블과 완료 카운트로 미션 보드 진행 상황 업데이트
- **session.idle** - 상태 줄에 마지막 활성 태스크와 함께 유휴 상태 표시
- **session.deleted** - 세션 종료 후 30초 동안 총 프롬프트 수, 수정된 파일 수, 활성 기간 표시

### 제한사항

- **lsp.client.diagnostics**는 등록되어 있지만, OpenCode 플러그인 API v1에서는 오류/경고 카운트를 사용할 수 없습니다. Presence에 표시되는 진단 카운트는 외부 LSP 구성이 필요합니다. 플러그인은 diagnostics 이벤트를 로그하지만 카운트를 임의로 생성하지 않습니다.

### Presence 상태

| 상태 | 영어 | 한국어 | 설명 |
|------|------|--------|------|
| 활성 (편집) | `✍️ Working with {agent}` | Same | 편집 중인 파일 |
| 활성 (읽기) | `📖 Working with {agent}` | Same | 읽고 있는 파일 |
| 태스크 활성 | `🎯 Working with {agent}` | Same | 미션 진행 상황과 함께 |
| Diagnostics 오류 | `🔴 Working with {agent}` | Same | 오류 감지됨 |
| 유휴 | `😴 {agent} is idle` | Same | 활동 없음 |
| 세션 완료 | `📊 Session Complete!` | Same | 세션 종료 (30초) |
| 모든 태스크 완료 | `🎉 All tasks complete!` | Same | 보류 중인 태스크 없음 |

한국어 조사 (을/를, 은/는)는 에이전트 이름의 받침 유무에 따라 자동으로 선택됩니다.

## 시각적 샘플 매트릭스

다음 상태들은 v1에서 완전 지원됩니다 (런타임 기반):

| 조건 | 제목 | 상태 줄 | 큰 이미지 |
|------|------|---------|-----------|
| 파일 편집 | `✍️ Working with Claude` | `src/plugin.ts` | 언어 아이콘 |
| 파일 읽기 | `📖 Working with Claude` | `src/services/discord-rpc.ts` | action-reading |
| 태스크 활성 | `🎯 Working with Claude` | `Implementing dark mode (2/5)` | task |
| Diagnostics 오류 | `🔴 Working with Claude` | `5 errors, 2 warnings` | state-error |
| 유휴 | `😴 Claude is idle` | `Last task: Add theme toggle` | state-idle |
| 세션 되돌아보기 | `📊 Session Complete!` | `27 prompts • 3 files • 1h 42m` | state-recap |
| 모든 태스크 완료 | `🎉 All tasks complete!` | `5/5 finished` | state-complete |

설명용 상태 (v1 미구현):

| 조건 | 제목 | 상태 줄 | 메모 |
|------|------|---------|------|
| 나이트 모드 | `🌙 Burning the midnight oil` | `📄 src/index.ts • 1h 42m` | 시간 기반 설정 추가 없이는 v1 미지원 |

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
├── plugin.ts             # OpenCode hook 등록 + presence 엔진
├── config.ts             # 설정 관리
├── types/
│   └── index.ts          # TypeScript 타입 정의
├── services/
│   └── discord-rpc.ts    # Discord RPC 서비스 (수명주기 강화됨)
├── state/
│   └── presence-state.ts # 인스턴스 범위 presence 스냅샷 + 리듀서
└── utils/
    ├── activity-rotation.ts # 우선순위 + 로테이션 엔진
    ├── file-label.ts        # 경로 정제 + 잘라냄
    ├── file-icons.ts        # 언어 → 아이콘 매핑
    ├── session-metrics.ts   # 세션 카운터 + 되돌아보기
    ├── tool-label.ts        # 도구 → 작업 레이블 매핑
    └── particle.ts          # 한국어 조사 처리 (을/를, 은/는)
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
