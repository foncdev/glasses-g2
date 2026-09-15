/**
 * 안경에 설치할 .ehpk를 만든다.
 *
 * 붙을 중계 서버 주소는 두 군데에 들어가야 한다.
 *   1. 번들 안 (VITE_RELAY_URL) — 어디로 붙을지
 *   2. app.json의 network whitelist — 붙어도 되는지
 * 한쪽만 맞으면 권한에서 막히거나 엉뚱한 곳을 본다.
 *
 * app.json은 공개 저장소에 있어 개인 IP를 적어둘 수 없다. 그래서 여기서
 * .env.production.local의 주소를 읽어 임시 app.json에 넣고, 그걸로 패킹한다.
 * 원본 app.json은 건드리지 않는다.
 *
 *   npm run pack
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

/** .env 파일에서 키 하나를 꺼낸다. */
function readEnv(file, key) {
  if (!fs.existsSync(file)) return '';
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = new RegExp(`^${key}\\s*=\\s*(.*)$`).exec(line.trim());
    if (m) return m[1].trim();
  }
  return '';
}

const envFile = path.join(root, '.env.production.local');
const relayUrl = readEnv(envFile, 'VITE_RELAY_URL');

if (!relayUrl) {
  console.error('VITE_RELAY_URL이 없습니다.');
  console.error('  cp .env.production.example .env.production.local');
  console.error('  그리고 붙을 중계 서버 주소를 적으세요.');
  process.exit(1);
}

// dist가 이 주소로 빌드됐는지 본다. 빌드를 안 했거나 주소를 바꾼 뒤
// 다시 빌드하지 않았으면 안경이 엉뚱한 서버를 본다.
const distDir = path.join(root, 'dist');
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('dist가 없습니다. 먼저 npm run build 를 돌리세요.');
  process.exit(1);
}

const bundled = fs
  .readdirSync(path.join(distDir, 'assets'))
  .filter((f) => f.endsWith('.js'))
  .some((f) => fs.readFileSync(path.join(distDir, 'assets', f), 'utf8').includes(relayUrl));

if (!bundled) {
  console.error(`dist에 ${relayUrl}이 없습니다. 주소를 바꾼 뒤 빌드하지 않았습니까?`);
  console.error('  npm run build');
  process.exit(1);
}

// whitelist에 실제 주소를 넣는다. 원본은 그대로 두고 임시 파일에만.
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

// 버전은 두 군데에 적혀 있다. 어긋나면 파일 이름과 안의 값이 달라져
// 어느 것이 기기에 깔렸는지 알 수 없게 된다.
const pkgVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (manifest.version !== pkgVersion) {
  console.error(`버전이 어긋납니다. app.json ${manifest.version} / package.json ${pkgVersion}`);
  console.error('두 파일을 같은 값으로 맞추세요.');
  process.exit(1);
}
for (const perm of manifest.permissions ?? []) {
  if (perm.name !== 'network') continue;
  const list = new Set(perm.whitelist ?? []);
  list.add(relayUrl);
  // 예시로 적어둔 주소는 뺀다. 실제로 쓰지 않는 곳이다.
  list.delete('http://192.168.0.10:4100');
  perm.whitelist = [...list];
}

const tmp = path.join(os.tmpdir(), `app.${process.pid}.json`);
fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));

/*
 * 산출물은 저장소 밖에 둔다.
 *
 * .gitignore로 막을 수도 있지만, 애초에 나오지 않는 편이 확실하다.
 * 이 파일에는 개인 네트워크 주소가 들어 있어 실수로도 올라가면 안 된다.
 */
const outDir = path.resolve(root, '..', 'dist-ehpk');
fs.mkdirSync(outDir, { recursive: true });

const out = path.join(outDir, `${manifest.package_id}-${manifest.version}.ehpk`);

try {
  execFileSync('npx', ['evenhub', 'pack', tmp, distDir, '-o', out], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log(`\n  ${out}`);
  console.log(`  붙을 서버: ${relayUrl}`);
  console.log(`  whitelist: ${manifest.permissions?.[0]?.whitelist?.join(', ')}`);
} finally {
  fs.rmSync(tmp, { force: true });
}
