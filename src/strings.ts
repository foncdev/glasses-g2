/**
 * 폰 화면(접속 설정·입력·로그)의 한국어·영어 글.
 *
 * 언어는 glasses-ui가 고른다(웹뷰 언어가 ko로 시작하면 한국어, 그 밖에는 영어).
 * 안경 화면 글은 glasses-ui의 i18n.ts에 있고, 여기는 이 호스트 앱의 폰 화면만 둔다.
 *
 * index.html의 고정 글은 data-i18n(글), data-i18n-placeholder, data-i18n-title
 * 속성에 키를 적어 두고 applyStaticText()가 시작할 때 바꿔 넣는다.
 * 언어를 더하려면 glasses-ui의 Locale에 코드를 더한 뒤 여기에도 판을 넣는다.
 */
import { getLocale, type Locale } from '@foncdev/glasses-ui';

const ko = {
  // index.html
  setupHint: '폰의 Relay 앱(127.0.0.1:4100)에 접속 키로 붙습니다. relay-service에 바로 붙으려면 그 주소를 넣으세요.',
  address: '주소',
  setupCode: '설정 코드',
  username: '아이디',
  password: '비밀번호',
  rememberKey: '접속 키 저장',
  connect: '연결',
  useRelay: '폰 Relay 앱으로 연결 (127.0.0.1:4100)',
  serverTitle: '붙어 있는 중계 서버. 눌러서 바꾼다',
  deleteOrigTitle: '이어가기 후 원본 기록을 지웁니다 (되돌릴 수 없음)',
  deleteOrig: '원본삭제',
  voice: '음성',
  promptPlaceholder: '프롬프트 입력',
  addTodoTitle: '할 일로 추가',
  addTodo: '＋할일',
  resume: '▶ 이어가기',
  send: '전송',

  // main.ts
  noSessions: '(연결된 세션이 없습니다)',
  newChat: '새 대화',
  relayAppConnected: 'Relay 앱(폰)에 연결',
  relayServiceConnected: (agent: string) => `relay-service 연결 (agent: ${agent})`,
  relayServiceNoAgent: 'relay-service 연결 (agent 대기 중)',
  enterAddress: '주소를 입력하세요.',
  connecting: '접속 중…',
  enterAccessKey: 'Relay 앱 설정의 접속 키를 입력하세요.',
  enterCredentials: '아이디와 비밀번호를 입력하세요.',
  createAdmin: '관리자 계정을 만드세요. 설정 코드는 서버 시작 로그에 있고, 비밀번호는 10자 이상입니다.',
  serverTooltip: (url: string) => `중계 서버: ${url}\n눌러서 바꾸기`,
  glassesConnected: '안경 연결됨',
  glassesNotConnected: (m: string) => `안경 미연결: ${m}`,
  noSessionList: (m: string) => `세션 목록 없음: ${m}`,
  hintKeyOnly: '폰의 Relay 앱에 붙습니다. 앱 설정 > 안경 접속의 키를 넣으세요.',
  hintLogin: 'Relay 서버에 로그인합니다.',
  hintSetup: '관리자 계정을 만듭니다. 이 계정으로 에이전트를 제어합니다.',
  accessKey: '접속 키',
  passwordMin: '비밀번호 (10자 이상)',
  login: '로그인',
  createAccount: '계정 만들기',
  sendFailed: (m: string) => `전송 실패: ${m}`,
  savedKeyConnecting: '저장한 접속 키로 연결합니다.',
  enterAccessKeyFromSettings: 'Relay 앱 설정 > 안경 접속의 접속 키를 입력하세요.',
  todoAdded: (n: number) => `할 일 추가: ${n}건`,
  todoAddFailed: (m: string) => `할 일 추가 실패: ${m}`,
  viaRelayApp: 'Relay 앱 중계를 통해 연결합니다.',
  loggedOut: '로그인이 풀렸습니다. 다시 로그인하세요.',
};

export type PhoneStrings = {
  readonly [K in keyof typeof ko]: (typeof ko)[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : string;
};

const en: PhoneStrings = {
  setupHint: 'Connects to the Relay app on your phone (127.0.0.1:4100) with an access key. To connect to relay-service directly, enter its address.',
  address: 'Address',
  setupCode: 'Setup code',
  username: 'Username',
  password: 'Password',
  rememberKey: 'Remember access key',
  connect: 'Connect',
  useRelay: 'Connect via the Relay phone app (127.0.0.1:4100)',
  serverTitle: 'Connected relay server. Tap to change',
  deleteOrigTitle: 'Delete the original history after resuming (cannot be undone)',
  deleteOrig: 'Delete original',
  voice: 'Voice',
  promptPlaceholder: 'Enter a prompt',
  addTodoTitle: 'Add as a to-do',
  addTodo: '＋To-Do',
  resume: '▶ Resume',
  send: 'Send',

  noSessions: '(no sessions connected)',
  newChat: 'New chat',
  relayAppConnected: 'Connected to the Relay app (phone)',
  relayServiceConnected: (agent) => `Connected to relay-service (agent: ${agent})`,
  relayServiceNoAgent: 'Connected to relay-service (waiting for agent)',
  enterAddress: 'Enter an address.',
  connecting: 'Connecting…',
  enterAccessKey: 'Enter the access key from the Relay app settings.',
  enterCredentials: 'Enter your username and password.',
  createAdmin: 'Create an admin account. The setup code is in the server start log; the password needs 10+ characters.',
  serverTooltip: (url) => `Relay server: ${url}\nTap to change`,
  glassesConnected: 'Glasses connected',
  glassesNotConnected: (m) => `Glasses not connected: ${m}`,
  noSessionList: (m) => `No session list: ${m}`,
  hintKeyOnly: 'Connects to the Relay app on your phone. Enter the key from Settings > Glasses access in the app.',
  hintLogin: 'Sign in to the Relay server.',
  hintSetup: 'Create an admin account. It controls your agents.',
  accessKey: 'Access Key',
  passwordMin: 'Password (10+ characters)',
  login: 'Sign in',
  createAccount: 'Create account',
  sendFailed: (m) => `Send failed: ${m}`,
  savedKeyConnecting: 'Connecting with the saved access key.',
  enterAccessKeyFromSettings: 'Enter the access key from Relay app Settings > Glasses access.',
  todoAdded: (n) => (n === 1 ? 'Added 1 to-do' : `Added ${n} to-dos`),
  todoAddFailed: (m) => `Couldn't add to-do: ${m}`,
  viaRelayApp: 'Connecting through the Relay app relay.',
  loggedOut: 'Signed out. Please sign in again.',
};

const CATALOGS: Readonly<Record<Locale, PhoneStrings>> = { ko, en };

/** 지금 언어의 폰 화면 글. */
export function t(): PhoneStrings {
  return CATALOGS[getLocale()];
}

type TextKey = { [K in keyof PhoneStrings]: PhoneStrings[K] extends string ? K : never }[keyof PhoneStrings];

function lookup(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const v = (t() as Record<string, unknown>)[key as TextKey];
  return typeof v === 'string' ? v : undefined;
}

/**
 * index.html의 고정 글을 지금 언어로 바꾼다.
 *
 * data-i18n은 요소의 글을 통째로 바꾸되, 안에 든 입력 칸(label 안의 input 등)은
 * 남긴다. 그래서 요소 안의 글 조각(text node)만 고친다.
 */
export function applyStaticText(root: ParentNode = document): void {
  document.documentElement.lang = getLocale();
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n]'))) {
    const text = lookup(node.dataset.i18n);
    if (text === undefined) continue;
    const textNodes = Array.from(node.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
    if (node.children.length === 0) {
      node.textContent = text;
    } else if (textNodes.length > 0) {
      // 첫 글 조각만 바꾸고 나머지 글 조각은 지운다. 입력 칸 앞뒤의 공백은 둔다.
      const [first, ...rest] = textNodes;
      const lead = /^\s*/.exec(first!.textContent ?? '')?.[0] ?? '';
      const trail = /\s*$/.exec(first!.textContent ?? '')?.[0] ?? '';
      first!.textContent = `${lead}${text}${trail}`;
      for (const n of rest) n.textContent = ' ';
    }
  }
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]'))) {
    const text = lookup(node.dataset.i18nPlaceholder);
    if (text !== undefined) (node as HTMLInputElement).placeholder = text;
  }
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n-title]'))) {
    const text = lookup(node.dataset.i18nTitle);
    if (text !== undefined) node.title = text;
  }
}
