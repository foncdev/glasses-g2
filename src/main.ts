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
  setLocale,
  type SessionInfo,
} from '@foncdev/glasses-ui';
import { BANNER } from './banner.js';
import { applyStaticText, t } from './strings.js';
import './style.css';

/*
 * 언어는 웹뷰 언어를 따른다(glasses-ui가 navigator.languages로 고른다).
 * 개발 중에는 ?lang=en / ?lang=ko로 덮어쓸 수 있다. 시뮬레이터의 웹뷰 언어는
 * 바꾸기 어려워 두 언어 화면을 이렇게 확인한다. 가장 먼저 해야 안경·폰 글이 다 따른다.
 */
if (import.meta.env.DEV) {
  const lang = new URLSearchParams(location.search).get('lang');
  if (lang) setLocale(lang);
}
applyStaticText();

const el = {
  setup: document.getElementById('setup') as HTMLElement,
  banner: document.getElementById('banner') as HTMLElement,
  main: document.getElementById('main') as HTMLElement,
  url: document.getElementById('url') as HTMLInputElement,
  key: document.getElementById('key') as HTMLInputElement,
  username: document.getElementById('username') as HTMLInputElement,
  code: document.getElementById('code') as HTMLInputElement,
  codeField: document.getElementById('code-field') as HTMLElement,
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
  remember: document.getElementById('remember') as HTMLInputElement,
  rememberField: document.getElementById('remember-field') as HTMLElement,
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

/**
 * 폰 로그 줄 수 상한.
 *
 * 예전에는 줄을 지우지 않아, 같은 경고가 몇 초마다 찍히면 페이지가 끝없이
 * 커졌다. 줄을 넣을 때마다 맨 아래로 스크롤하느라 배치도 다시 계산해
 * 웹뷰가 CPU·메모리를 먹다 iOS에 죽는 원인이 될 수 있다.
 */
const LOG_MAX_LINES = 200;

function phoneLog(text: string, level = 'info'): void {
  const div = document.createElement('div');
  div.className = `line ${level === 'info' ? '' : level}`;
  div.textContent = text;
  el.log.appendChild(div);
  while (el.log.childElementCount > LOG_MAX_LINES) el.log.firstElementChild?.remove();
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
    el.glasses.textContent = t().noSessions;
    return;
  }
  el.glasses.textContent = sessions
    .map((s, i) => `${i === cursor ? '▸' : ' '} ${s.title || t().newChat}`)
    .join('\n');
}

// --- 접속 ---

const STORE_URL = 'agentcli.url';
/**
 * 로그인 토큰을 두는 곳. 관리 화면(`/web`)과 같은 이름을 쓴다.
 *
 * 둘은 같은 주소(ip:4100)에서 열리므로 브라우저 저장소를 함께 쓴다. 한쪽에서
 * 로그인하면 다른 쪽도 로그인된 채로 열린다. 예전에는 이름이 하이픈 하나
 * 달라서(agentcli.token / agent-cli.token) 따로 로그인해야 했다.
 */
const STORE_TOKEN = 'relay.token';
/** 예전 이름. 읽기만 하고, 새로 저장할 때 비운다. */
const OLD_TOKEN_KEYS = ['agentcli.token', 'agent-cli.token'];

async function loadToken(): Promise<string> {
  // 한꺼번에 읽는다. 하나씩 읽으면 브리지가 늦을 때 그 몫이 쌓여 연결
  // 버튼이 그만큼 오래 꺼져 있었다.
  const values = await Promise.all([STORE_TOKEN, ...OLD_TOKEN_KEYS].map((k) => adapter.loadSetting(k)));
  return values.find(Boolean) ?? '';
}

/*
 * 마지막으로 로그인한 정보.
 *
 * 로그인 칸이 다시 뜰 때(로그인이 풀림, 서버 바꾸기, 앱을 다시 설치) 매번 키를
 * 다시 치지 않게 채워 둔다. 폰 Relay 앱의 접속 키는 그 주소와 함께 저장해,
 * 같은 주소일 때만 채운다 — 다른 서버의 비밀번호 칸에 들어가면 안 된다.
 * relay-service 계정의 비밀번호는 저장하지 않는다. 그쪽은 토큰으로 다시 붙는다.
 */
const STORE_USER = 'relay.username';
const STORE_KEY = 'relay.accessKey';

async function rememberLogin(baseUrl: string, keyOnly: boolean, username: string, key: string): Promise<void> {
  if (!keyOnly && username) await adapter.saveSetting(STORE_USER, username);
  if (!keyOnly) return;
  // 저장을 끄면 저장해 둔 키도 지운다.
  await adapter.saveSetting(STORE_KEY, el.remember.checked && key ? JSON.stringify({ url: baseUrl, key }) : '');
}

/** 저장해 둔 로그인 정보로 칸을 채운다. 이미 적힌 것은 건드리지 않는다. */
async function fillSavedLogin(): Promise<void> {
  if (!el.username.value) el.username.value = await adapter.loadSetting(STORE_USER);
  if (el.key.value) return;
  try {
    const saved = JSON.parse((await adapter.loadSetting(STORE_KEY)) || '{}') as { url?: string; key?: string };
    if (saved.key && saved.url === el.url.value.trim()) el.key.value = saved.key;
  } catch {
    // 저장이 깨졌으면 비워 둔다.
  }
}

async function saveToken(token: string): Promise<void> {
  await adapter.saveSetting(STORE_TOKEN, token);
  for (const key of OLD_TOKEN_KEYS) await adapter.saveSetting(key, '');
  // 관리 화면은 브라우저 저장소만 본다. 비운 값은 지워 둔다.
  if (!token) {
    try {
      for (const key of [STORE_TOKEN, ...OLD_TOKEN_KEYS]) localStorage.removeItem(key);
    } catch {
      // 저장소가 막혀 있으면 넘어간다.
    }
  }
}

/**
 * 같은 폰에서 도는 Relay 앱의 주소. G2 앱 허용 목록에 있는 포트(4100)다.
 * 여기로 붙으면 앱이 정한 접속 키로 로그인한다. relay-service는 앱이 대신 이야기한다.
 */
const RELAY_ADDRESS = 'http://127.0.0.1:4100';

/** 개발 중 시뮬레이터에서 매번 입력하지 않도록 쿼리로 접속 정보를 받는다. */
function applyQueryOverrides(): boolean {
  const q = new URLSearchParams(location.search);
  const host = q.get('host');
  const user = q.get('user');
  const key = q.get('key');
  if (host) el.url.value = host;
  // 계정 로그인이 생긴 뒤로는 아이디도 있어야 자동으로 붙는다.
  if (user) el.username.value = user;
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
    const status = (await res.json()) as { ok?: boolean; local?: boolean; agents?: Array<{ name: string }> };
    if (typeof status.ok !== 'boolean') return { found: false, needsKey: false };

    // 폰의 Relay 앱이 답했다(서버 없이 쓰는 중이거나 서버에 닿지 않는다).
    if (status.local) {
      phoneLog(t().relayAppConnected, 'ok');
      return { found: true, needsKey: true };
    }
    const agent = status.agents?.[0]?.name;
    phoneLog(
      agent ? t().relayServiceConnected(agent) : t().relayServiceNoAgent,
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

/** 마지막으로 붙은 곳이 폰(접속 키)인지. 로그인 칸을 다시 띄울 때 쓴다. */
let keyOnlyMode = false;

/** 접속을 시도하는 중인지. 부팅 때 자동 접속과 버튼이 겹치지 않게 한다. */
let connecting = false;

async function connect(): Promise<void> {
  const baseUrl = el.url.value.trim();
  if (!baseUrl) {
    el.setupMsg.textContent = t().enterAddress;
    return;
  }
  if (connecting) return;
  connecting = true;

  el.connect.disabled = true;
  el.setupMsg.textContent = t().connecting;

  try {
    // 저장된 토큰이 있으면 그걸로 먼저 붙어본다.
    // 관리 화면(/web)에서 로그인했으면 그 토큰도 여기서 보인다.
    const saved = await loadToken();
    if (saved && !el.key.value) {
      agentCli.configure({ baseUrl, apiKey: saved });
      try {
        // relay가 직접 답하는 경로로 토큰을 확인한다. /health는 agent로
        // 넘어가서, agent가 꺼져 있으면 토큰이 멀쩡해도 503으로 실패했다.
        await agentCli.motd();
        await afterAuth(baseUrl, saved);
        return;
      } catch (err) {
        // 만료됐거나 다른 곳에서 로그아웃했다. 남은 토큰을 지우고 로그인 칸을
        // 띄운다. 예전에는 지우지 않아 다음에도 같은 토큰으로 실패했다.
        if (!(err instanceof AgentCliError && err.status === 401)) throw err;
        await saveToken('');
        agentCli.configure({ baseUrl, apiKey: '' });
      }
    }

    // 토큰이 없으면 아이디/비밀번호로 로그인한다.
    agentCli.configure({ baseUrl, apiKey: '' });
    const status = await agentCli.authStatus();

    // 폰의 Relay 앱에 붙었으면 앱이 정한 접속 키 하나로 들어간다.
    const keyOnly = status.mode === 'key';
    keyOnlyMode = keyOnly;
    // 칸이 비어 있으면 마지막으로 로그인한 정보로 채운다. 폰 Relay 앱이면 저장한
    // 접속 키로 곧바로 다시 들어간다.
    await fillSavedLogin();
    const username = keyOnly ? 'relay' : el.username.value.trim();
    const password = el.key.value;
    const code = el.code.value.trim();
    if (!username || !password || (!status.configured && !code)) {
      showLoginFields(status.configured, keyOnly);
      el.setupMsg.textContent = keyOnly
        ? t().enterAccessKey
        : status.configured
          ? t().enterCredentials
          : t().createAdmin;
      return;
    }

    const token = status.configured
      ? await agentCli.login(username, password)
      : await agentCli.setup(username, password, code);
    await rememberLogin(baseUrl, keyOnly, username, password);

    agentCli.configure({ baseUrl, apiKey: token });
    await afterAuth(baseUrl, token);
  } catch (err) {
    const message = err instanceof AgentCliError ? err.message : (err as Error).message;
    el.setupMsg.textContent = message;
    // 인증 문제면 입력 칸을 보여준다. 상태 코드로 먼저 보고, 코드가 없는 서버 문구는
    // 서버가 보낸 글(한국어·영어)로 가린다. 화면 글과는 견주지 않는다.
    const authError =
      (err instanceof AgentCliError && (err.status === 401 || err.status === 403)) ||
      /비밀번호|아이디|인증|로그인|접속 키|password|username|credential|unauthori[sz]ed|sign[ -]?in|log[ -]?in|access key/i.test(message);
    if (authError) showLoginFields(true, keyOnlyMode);
  } finally {
    connecting = false;
    el.connect.disabled = false;
  }
}

/**
 * 인증이 끝난 뒤 공통 처리.
 *
 * 화면 전환과 토큰 저장만 기다리고, 안경 연결·첫 화면 그리기는 뒤에서
 * 돌린다. 예전에는 블루투스로 안경을 붙이고 그리는 것까지 다 기다려서,
 * 그동안 연결 버튼이 꺼진 채였다.
 */
async function afterAuth(baseUrl: string, token: string): Promise<void> {
  // 화면 전환과 토큰 저장을 먼저 끝낸다.
  // 세션 목록은 agent-cli가 붙어 있어야 읽히는데, 로그인은 그것과 무관하다.
  el.setup.hidden = true;
  el.main.hidden = false;
  el.setupMsg.textContent = '';

  // 어디에 붙었는지 헤더에 남긴다. 눌러서 바꿀 수 있다.
  // 주소는 길어서 호스트만 보여준다.
  el.server.textContent = hostOf(baseUrl);
  el.server.title = t().serverTooltip(baseUrl);

  void adapter.saveSetting(STORE_URL, baseUrl);
  void saveToken(token);

  void afterAuthGlasses();
}

/** 로그인 뒤 안경 쪽 일. 늦어도 폰 화면을 막지 않게 따로 돈다. */
async function afterAuthGlasses(): Promise<void> {
  // 안경 연결이 아직이면 지금 다시 시도한다.
  if (!glassesReady) {
    try {
      await relay.start();
      glassesReady = true;
      phoneLog(t().glassesConnected, 'ok');
    } catch (err) {
      phoneLog(t().glassesNotConnected((err as Error).message), 'warn');
    }
  }

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
    phoneLog(t().noSessionList((err as Error).message), 'warn');
  }
}

/** 로그인 입력 칸을 드러낸다. 설정 전이면 문구를 바꾼다. */
function showLoginFields(configured: boolean, keyOnly = false): void {
  // 폰에 붙으면 아이디가 없다. 접속 키만 받는다.
  el.userField.hidden = keyOnly;
  el.rememberField.hidden = !keyOnly;
  // 설정 코드는 계정을 만들 때만 받는다. relay-service가 시작 로그에 찍는다.
  el.codeField.hidden = configured;
  const hint = document.querySelector('#setup .hint');
  if (hint) {
    hint.textContent = keyOnly ? t().hintKeyOnly : configured ? t().hintLogin : t().hintSetup;
  }
  el.keyLabel.textContent = keyOnly ? t().accessKey : configured ? t().password : t().passwordMin;
  el.key.type = keyOnly ? 'text' : 'password';
  el.key.autocapitalize = keyOnly ? 'characters' : 'off';
  el.connect.textContent = configured ? t().login : t().createAccount;
  if (!configured && !el.code.value) el.code.focus();
  else if (!keyOnly && !el.username.value) el.username.focus();
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
    phoneLog(t().sendFailed((err as Error).message), 'error');
  } finally {
    el.send.disabled = false;
  }
}

async function boot(): Promise<void> {
  el.connect.addEventListener('click', () => void connect());
  // 자동 탐색이 실패해도 손으로 폰의 Relay 앱에 붙어볼 수 있게 한다.
  // 접속 키 칸을 곧바로 띄운다. 키를 넣고 연결을 누르면 로그인한다.
  el.useRelay.addEventListener('click', async () => {
    el.url.value = RELAY_ADDRESS;
    el.key.value = '';
    await fillSavedLogin();
    keyOnlyMode = true;
    showLoginFields(true, true);
    el.setupMsg.textContent = el.key.value ? t().savedKeyConnecting : t().enterAccessKeyFromSettings;
    void connect();
  });

  /**
   * 붙어 있는 서버를 바꾼다.
   *
   * 접속 화면으로 되돌아가되 지금 주소를 채워 둔다. 대개 IP 한두 자리만
   * 바꾸므로 처음부터 치게 하지 않는다. 비밀번호는 비운다 — 서버가
   * 달라지면 계정도 다른 것이 보통이다. 폰 Relay 앱의 접속 키는 저장해 둔
   * 주소와 같을 때만 다시 채운다.
   */
  el.server.addEventListener('click', async () => {
    el.main.hidden = true;
    el.setup.hidden = false;
    el.setupMsg.textContent = '';
    el.key.value = '';
    await fillSavedLogin();
    // 지금 붙은 방식(접속 키·계정)에 맞게 칸을 보인다. 키 저장 체크도 여기서 끌 수 있다.
    showLoginFields(true, keyOnlyMode);
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
        phoneLog(t().todoAdded(text.split('\n').length), 'ok');
      })
      .catch((err: Error) => phoneLog(t().todoAddFailed(err.message), 'error'));
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
    phoneLog(t().glassesConnected, 'ok');

    // 저장된 주소는 자동 감지가 실패했을 때만 쓴다. 여기서 채우면
    // 이 앱을 서빙한 서버보다 옛 주소가 우선해버린다.
    // 토큰은 connect가 직접 읽으므로 비밀번호 칸에 넣지 않는다.
    el.tts.checked = adapter.isVoiceEnabled;
  } catch (err) {
    phoneLog(t().glassesNotConnected((err as Error).message), 'warn');
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

    // 2순위: 빌드에 박아둔 주소.
    //
    // 저장된 주소보다 먼저 쓴다. 개발하면서 서버를 옮기면 옛 주소가
    // 저장소에 남아 계속 그리로 붙으려 하기 때문이다. 이 값은 빌드할 때
    // 일부러 넣은 것이므로 그쪽 뜻이 더 분명하다.
    if (!el.url.value && DEFAULT_RELAY) el.url.value = DEFAULT_RELAY;

    // 3순위: 저장해둔 주소.
    if (!el.url.value) el.url.value = await adapter.loadSetting(STORE_URL);

    // 4순위: 같은 폰의 Relay 앱 중계.
    if (!el.url.value && (await findLocalRelay())) {
      el.url.value = RELAY_ADDRESS;
      el.key.value = '';
      phoneLog(t().viaRelayApp, 'ok');
    }
  }

  // 쓰는 중에 토큰이 폐기되거나 만료됐다. 로그인 칸을 다시 띄운다.
  // 저장된 토큰은 여기서 지우지 않는다 — 부팅 중 로그인 전 요청의 401에도
  // 불리므로, 지우면 멀쩡한 토큰을 읽기도 전에 잃는다. 죽은 토큰은
  // connect가 확인하고 지운다.
  agentCli.onUnauthorized(() => {
    if (el.main.hidden) return;
    el.main.hidden = true;
    el.setup.hidden = false;
    el.key.value = '';
    showLoginFields(true, keyOnlyMode);
    el.setupMsg.textContent = t().loggedOut;
    // 저장한 키가 있으면 채워 둔다. 키를 바꾸지 않았다면 연결만 누르면 된다.
    void fillSavedLogin();
  });

  if (autoConnect || el.url.value) void connect();

  // 목록 상태를 주기적으로 맞춘다.
  setInterval(() => {
    // 401을 받은 뒤로는 멈춘다. 로그인 화면에 머무는 동안 relay 로그에
    // '인증 실패'가 5초마다 쌓였다.
    if (agentCli.isConfigured && agentCli.canPoll && !relay.isDetail) void relay.refresh().catch(() => undefined);
  }, 5000);
}

void boot();
