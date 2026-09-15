# glasses-g2

Even Realities G2 안경에서 도는 호스트 앱. Even 컴패니언 앱의 WebView에
올라가 [glasses-ui](https://github.com/foncdev/glasses-ui)를 띄운다.

맥에서 도는 Claude Code CLI를 안경 터치패드로 조종하는 것이 목적이다.
세션을 고르고, 진행 상황을 보고, 권한 요청에 답한다.

## 이 저장소가 갖는 것

로직은 갖지 않는다. 화면 전환·제스처·서버 통신은 전부 `glasses-ui`에 있다.
여기 있는 것은 그걸 Even Hub 앱으로 만드는 데 필요한 것뿐이다.

| 파일 | 역할 |
|---|---|
| `app.json` | Even Hub 매니페스트. 패키지 ID, 권한, network whitelist |
| `src/main.ts` | 부팅, 서버 주소 탐색, 폰 화면 요소 연결 |
| `src/banner.ts` | 로그인 화면 로고 |
| `vite.config.ts` | 빌드 설정 |

`app.json`과 `even_hub_sdk`에 묶여 있어 **G2 전용이다.** 다른 안경을
붙이려면 호스트 앱을 따로 만들고 `glasses-ui`에 어댑터를 더한다.

## 준비물

- Node 22
- [relay-service](https://github.com/foncdev/relay-service) — 중계 서버
- G2 안경과 Even 컴패니언 앱 (실기기 테스트용)

## 실행

```bash
npm install
npm run dev          # :5173, 브라우저에서 확인
```

시뮬레이터로 보려면 `@evenrealities/evenhub-simulator`를 쓴다.

## 빌드

붙을 중계 서버 주소를 먼저 정한다. 플러그인으로 설치하면 `file://`에서
돌아 `location.origin`을 쓸 수 없어, 빌드 시점에 주소를 박아 넣는다.

```bash
cp .env.production.example .env.production.local
# VITE_RELAY_URL을 자기 서버 주소로 바꾼다

npm run build        # dist/
```

**같은 주소를 `app.json`의 network whitelist에도 넣어야 한다.** 한쪽만
고치면 권한이 막혀 접속되지 않는다.

안경에 설치할 `.ehpk`는 `@evenrealities/evenhub-cli`로 만든다.

## 접속 대상 찾기

이 순서로 시도한다.

1. 이 앱을 내려준 서버 (`origin/relay/status`) — 웹으로 열었을 때
2. 저장된 주소 — 전에 입력해 둔 것
3. `http://127.0.0.1:8787` — 같은 폰의 iOS 앱이 띄운 프록시

3번 경로를 쓰면 안경앱이 맥 주소도 API 키도 모른 채로 동작한다.
폰이 대신 들고 있다가 붙여 보낸다.

## G2의 사정

화면과 입력이 제한적이라 `glasses-ui`의 G2 어댑터가 이런 것들을 흡수한다.

- 화면은 576×288, 4비트 흑백. 리스트 20줄 × 64자가 상한
- protobuf가 영값을 생략해서 탭(0)과 인덱스 0이 `undefined`로 온다
- BLE 호출이 겹치면 연결이 끊긴다. 직렬화가 필요하다
- 폰트에 겹선(`═ ║`)이 없다. 로고는 둥근 모서리와 굵은 선만 쓴다

제스처는 탭·더블탭·위·아래 넷뿐이고, **더블탭은 언제나 한 단계 위**로 간다.

## 관련

- [glasses-ui](https://github.com/foncdev/glasses-ui) — 화면과 제스처 로직
- [relay-service](https://github.com/foncdev/relay-service) — 중계 서버
- [claudeAgent](https://github.com/foncdev/claudeAgent) — CLI 제어 매니저

## 라이선스

MIT
