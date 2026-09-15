/**
 * G2 호스트 앱.
 *
 * Even 컴패니언 앱의 WebView에서 돌면서 relay를 띄우는 껍데기다.
 * 실제 로직은 relay가 가지고 있고, 여기서는 폰 화면(접속 설정·입력·로그)만 맡는다.
 *
 * 구조: agent-cli(맥) <--> relay <--> G2 어댑터 <--BLE--> 안경
 */

import {
  agentCli,
  AgentCliError,
  G2Adapter,
  GlassesUI,
  type SessionInfo,
} from '@foncdev/glasses-ui';
import { BANNER } from './banner.js';
import './style.css';

const el = {
  setup: document.getElementById('setup') as HTMLElement,
  banner: document.getElementById('banner') as HTMLElement,
  main: document.getElementById('main') as HTMLElement,
  url: document.getElementById('url') as HTMLInputElement,
  key: document.getElementById('key') as HTMLInputElement,
  username: document.getElementById('username') as HTMLInputElement,
  userField: document.getElementById('user-field') as HTMLElement,
  keyLabel: document.getElementById('key-label') as HTMLElement,
  connect: document.getElementById('connect') as HTMLButtonElement,
  setupMsg: document.getElementById('setup-msg') as HTMLElement,
  title: document.getElementById('title') as HTMLElement,
  log: document.getElementById('log') as HTMLElement,
  prompt: document.getElementById('prompt') as HTMLTextAreaElement,
  send: document.getElementById('send') as HTMLButtonElement,
  back: document.getElementById('back') as HTMLButtonElement,
  tts: document.getElementById('tts') as HTMLInputElement,
  glasses: document.getElementById('glasses') as HTMLElement,
  resume: document.getElementById('resume') as HTMLButtonElement,
  deleteOrig: document.getElementById('delete-orig') as HTMLInputElement,
  useRelay: document.getElementById('use-relay') as HTMLButtonElement,
  addTodo: document.getElementById('add-todo') as HTMLButtonElement,
  server: document.getElementById('server') as HTMLButtonElement,
};

/** 주소에서 호스트만 뽑는다. 헤더가 좁아 전체를 넣으면 밀린다. */
function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}

function phoneLog(text: string, level = 'info'): void {
  const div = document.createElement('div');
  div.className = `line ${level === 'info' ? '' : level}`;
  div.textContent = text;
  el.log.appendChild(div);
  el.log.scrollTop = el.log.scrollHeight;
}

/** 안경이 붙었는지. 붙기 전에는 화면을 그릴 수 없다. */
let glassesReady = false;

const adapter = new G2Adapter();
const relay = new GlassesUI(adapter, {
  onLog: (text, level) => phoneLog(text, level),
  onSessionsChanged: (sessions, cursor) => renderMirror(sessions, cursor),
});

/**
 * 안경에 뜬 세션 목록을 폰에서도 볼 수 있게 그린다.
 *
 * 전역 할 일과 음성 토글은 홈 메뉴·설정으로 옮겨가서 여기서는 빼고,
 * 세션만 비춘다.
 */
function renderMirror(sessions: SessionInfo[], cursor: number): void {
  if (sessions.length === 0) {
    el.glasses.textContent = '(연결된 세션이 없습니다)';
    return;
  }
  el.glasses.textContent = sessions
    .map((s, i) => `${i === cursor ? '▸' : ' '} ${s.title || '새 대화'}`)
    .join('\n');
}

// --- 접속 ---

const STORE_URL = 'agentcli.url';
const STORE_TOKEN = 'agentcli.token';

/**
 * 같은 폰에서 도는 Relay 앱의 중계 주소.
 * 여기로 붙으면 맥 주소와 API 키는 Relay가 들고 있으므로 몰라도 된다.
 */
const RELAY_ADDRESS = 'http://127.0.0.1:8787';

/** 개발 중 시뮬레이터에서 매번 입력하지 않도록 쿼리로 접속 정보를 받는다. */
function applyQueryOverrides(): boolean {
  const q = new URLSearchParams(location.search);
  const host = q.get('host');
  const key = q.get('key');
  if (host) el.url.value = host;
  if (key) el.key.value = key;
  return q.get('auto') === '1' && Boolean(host);
}

/**
 * 빌드 시 박아 넣는 기본 relay-service 주소.
 *
 * 플러그인으로 설치하면 앱이 file://에서 돌아 location.origin을 쓸 수 없다.
 * 그래서 어느 서버에 붙을지 미리 정해둔다. 사용자가 바꿀 수도 있다.
 */
const DEFAULT_RELAY = import.meta.env.VITE_RELAY_URL ?? '';

/**
 * relay-service를 찾는다.
 *
 * 웹으로 열었으면 이 앱을 내려준 서버가 곧 relay-service다.
 * 플러그인으로 설치했으면 빌드에 박아둔 주소를 쓴다.
 */
async function findServingRelay(): Promise<{ found: boolean; needsKey: boolean }> {
  // file://이면 origin이 쓸모없다. 기본 주소로 간다.
  const origin = location.protocol.startsWith('http') ? location.origin : DEFAULT_RELAY;
  if (!origin) return { found: false, needsKey: false };

  try {
    const res = await fetch(`${origin}/relay/status`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { found: false, needsKey: false };

    // 응답이 오면 relay-service가 맞다.
    // agent-cli 연결 여부는 별개다. 체크리스트 등은 서버가 직접 관리하므로
    // agent가 없어도 로그인하고 쓸 수 있어야 한다.
    const status = (await res.json()) as { ok?: boolean; agents?: Array<{ name: string }> };
    if (typeof status.ok !== 'boolean') return { found: false, needsKey: false };

    const agent = status.agents?.[0]?.name;
    phoneLog(
      agent ? `relay-service 연결 (agent: ${agent})` : 'relay-service 연결 (agent 대기 중)',
      agent ? 'ok' : 'warn',
    );
    return { found: true, needsKey: true };
  } catch {
    // 이 앱을 준 서버가 relay-service가 아니면 기존 방식으로 간다.
    return { found: false, needsKey: false };
  }
}

/**
 * 같은 폰의 Relay 앱 중계가 살아 있는지 본다.
 * relay-service를 못 찾았을 때의 대안 경로다.
 */
async function findLocalRelay(): Promise<boolean> {
  try {
    const res = await fetch(`${RELAY_ADDRESS}/relay/status`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return false;
    const status = (await res.json()) as { ok?: boolean };
    return status.ok === true;
  } catch {
    return false;
  }
}

async function connect(): Promise<void> {
  const baseUrl = el.url.value.trim();
  if (!baseUrl) {
    el.setupMsg.textContent = '주소를 입력하세요.';
    return;
  }

  el.connect.disabled = true;
  el.setupMsg.textContent = '접속 중…';

  try {
    // 저장된 토큰이 있으면 그걸로 먼저 붙어본다.
    const saved = await adapter.loadSetting(STORE_TOKEN);
    if (saved && !el.key.value) {
      agentCli.configure({ baseUrl, apiKey: saved });
      await agentCli.health();
      await afterAuth(baseUrl, saved);
      return;
    }

    // 토큰이 없으면 아이디/비밀번호로 로그인한다.
    agentCli.configure({ baseUrl, apiKey: '' });
    const status = await agentCli.authStatus();

    const username = el.username.value.trim();
    const password = el.key.value;
    if (!username || !password) {
      showLoginFields(status.configured);
      el.setupMsg.textContent = status.configured
        ? '아이디와 비밀번호를 입력하세요.'
        : '관리자 계정을 만드세요. 비밀번호는 10자 이상입니다.';
      return;
    }

    const token = status.configured
      ? await agentCli.login(username, password)
      : await agentCli.setup(username, password);

    agentCli.configure({ baseUrl, apiKey: token });
    await afterAuth(baseUrl, token);
  } catch (err) {
    const message = err instanceof AgentCliError ? err.message : (err as Error).message;
    el.setupMsg.textContent = message;
    // 인증 문제면 입력 칸을 보여준다.
    if (/비밀번호|아이디|인증|로그인/.test(message)) showLoginFields(true);
  } finally {
    el.connect.disabled = false;
  }
}

/** 인증이 끝난 뒤 공통 처리. */
async function afterAuth(baseUrl: string, token: string): Promise<void> {
  // 안경 연결이 아직이면 지금 다시 시도한다.
  if (!glassesReady) {
    try {
      await relay.start();
      glassesReady = true;
      phoneLog('G2 연결됨', 'ok');
    } catch (err) {
      phoneLog(`G2 미연결: ${(err as Error).message}`, 'warn');
    }
  }

  // 화면 전환과 토큰 저장을 먼저 끝낸다.
  // 세션 목록은 agent-cli가 붙어 있어야 읽히는데, 로그인은 그것과 무관하다.
  el.setup.hidden = true;
  el.main.hidden = false;
  el.setupMsg.textContent = '';

  // 어디에 붙었는지 헤더에 남긴다. 눌러서 바꿀 수 있다.
  // 주소는 길어서 호스트만 보여준다.
  el.server.textContent = hostOf(baseUrl);
  el.server.title = `중계 서버: ${baseUrl}\n눌러서 바꾸기`;

  void adapter.saveSetting(STORE_URL, baseUrl);
  void adapter.saveSetting(STORE_TOKEN, token);

  // 접속하면 서버 상태부터 알려준다. 로그인 직후 빈 화면은 불친절하다.
  // 폰 로그와 안경 화면 양쪽에 띄운다. 안경만 보는 경우가 많다.
  try {
    const { lines } = await agentCli.motd();
    for (const line of lines) phoneLog(line, 'motd');
    // 안경에는 서버 상태를 띄우지 않는다. 상단 요약이 같은 내용을 더 짧게 준다.
    if (glassesReady) await relay.showMotd();
  } catch {
    // MOTD는 없어도 그만이다.
  }

  // 홈 요약(세션·알림·체크)을 채운다.
  // start()는 로그인 전에 돌아 인증이 없으므로 여기서 다시 읽어야 한다.
  // 안 그러면 안경 홈에 0만 떠서 고장난 것처럼 보인다.
  try {
    await relay.refreshHome();
  } catch (err) {
    // agent-cli가 없어도 알림·체크리스트는 쓸 수 있다.
    phoneLog(`세션 목록 없음: ${(err as Error).message}`, 'warn');
  }
}

/** 로그인 입력 칸을 드러낸다. 설정 전이면 문구를 바꾼다. */
function showLoginFields(configured: boolean): void {
  el.userField.hidden = false;
  const hint = document.querySelector('#setup .hint');
  if (hint) {
    hint.textContent = configured
      ? 'Relay 서버에 로그인합니다.'
      : '관리자 계정을 만듭니다. 이 계정으로 에이전트를 제어합니다.';
  }
  el.keyLabel.textContent = configured ? '비밀번호' : '비밀번호 (10자 이상)';
  el.connect.textContent = configured ? '로그인' : '계정 만들기';
  if (!el.username.value) el.username.focus();
  else el.key.focus();
}

async function send(): Promise<void> {
  const prompt = el.prompt.value.trim();
  if (!prompt) return;
  el.send.disabled = true;
  try {
    await relay.send(prompt);
    el.prompt.value = '';
  } catch (err) {
    phoneLog(`전송 실패: ${(err as Error).message}`, 'error');
  } finally {
    el.send.disabled = false;
  }
}

async function boot(): Promise<void> {
  el.connect.addEventListener('click', () => void connect());
  // 자동 탐색이 실패해도 손으로 중계에 붙어볼 수 있게 한다.
  el.useRelay.addEventListener('click', () => {
    el.url.value = RELAY_ADDRESS;
    el.key.value = '';
    void connect();
  });

  /**
   * 붙어 있는 서버를 바꾼다.
   *
   * 접속 화면으로 되돌아가되 지금 주소를 채워 둔다. 대개 IP 한두 자리만
   * 바꾸므로 처음부터 치게 하지 않는다. 비밀번호는 비운다 — 서버가
   * 달라지면 계정도 다른 것이 보통이다.
   */
  el.server.addEventListener('click', () => {
    el.main.hidden = true;
    el.setup.hidden = false;
    el.setupMsg.textContent = '';
    el.key.value = '';
    el.url.focus();
    el.url.select();
  });

  el.send.addEventListener('click', () => void send());
  // 입력창 내용을 프롬프트 대신 할 일로 넣는다. 여러 줄이면 줄마다 항목이 된다.
  el.addTodo.addEventListener('click', () => {
    const text = el.prompt.value.trim();
    if (!text) return;
    void relay
      .addChecklist(text)
      .then(() => {
        el.prompt.value = '';
        phoneLog(`할 일 추가: ${text.split('\n').length}건`, 'ok');
      })
      .catch((err: Error) => phoneLog(`할 일 추가 실패: ${err.message}`, 'error'));
  });
  el.back.addEventListener('click', () => void relay.backToList());
  el.resume.addEventListener('click', () => {
    if (relay.currentSessionId) void relay.resume(relay.currentSessionId, el.deleteOrig.checked);
  });
  el.tts.addEventListener('change', () => void relay.toggleVoice());
  el.prompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void send();
    }
  });

  // 로그인 화면 배너. 폰트에 있는 문자라 폰에서는 그대로 보인다.
  el.banner.textContent = BANNER;

  const autoConnect = applyQueryOverrides();

  // 안경이 없으면(브라우저 테스트) 폰 화면만 동작한다.
  try {
    await relay.start();
    glassesReady = true;
    phoneLog('G2 연결됨', 'ok');

    // 저장된 주소는 자동 감지가 실패했을 때만 쓴다. 여기서 채우면
    // 이 앱을 서빙한 서버보다 옛 주소가 우선해버린다.
    // 토큰은 connect가 직접 읽으므로 비밀번호 칸에 넣지 않는다.
    el.tts.checked = adapter.isVoiceEnabled;
  } catch (err) {
    phoneLog(`G2 미연결: ${(err as Error).message}`, 'warn');
  }

  if (!autoConnect) {
    // 1순위: 이 앱을 내려준 서버가 relay-service면 거기로 바로 붙는다.
    const serving = await findServingRelay();
    if (serving.found) {
      // 주소는 이 앱을 내려준 서버다. 물어볼 이유가 없으므로 칸을 감춘다.
      el.url.value = location.protocol.startsWith('http') ? location.origin : DEFAULT_RELAY;
      const urlField = el.url.closest('label');
      if (urlField instanceof HTMLElement) urlField.hidden = true;
      el.useRelay.hidden = true;
      // 비밀번호 칸은 비워둔다. 저장된 토큰은 connect가 알아서 쓴다.
      el.key.value = '';
      void connect();
      return;
    }

    // 2순위: 저장해둔 주소.
    if (!el.url.value) el.url.value = await adapter.loadSetting(STORE_URL);

    // 3순위: 같은 폰의 Relay 앱 중계.
    if (!el.url.value && (await findLocalRelay())) {
      el.url.value = RELAY_ADDRESS;
      el.key.value = '';
      phoneLog('Relay 앱 중계를 통해 연결합니다.', 'ok');
    }
  }

  if (autoConnect || el.url.value) void connect();

  // 목록 상태를 주기적으로 맞춘다.
  setInterval(() => {
    if (agentCli.isConfigured && !relay.isDetail) void relay.refresh().catch(() => undefined);
  }, 5000);
}

void boot();
