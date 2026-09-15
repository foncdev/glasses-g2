import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * glasses-ui는 file: 링크로 들어와 심볼릭 링크 상태다.
 * 그 안에서 import하는 SDK를 이 앱의 node_modules에서 찾도록 명시한다.
 * 링크를 그대로 두는 편이 개발 중 수정이 바로 반영돼 편하다.
 */
const sdk = fileURLToPath(
  new URL('./node_modules/@evenrealities/even_hub_sdk', import.meta.url),
);

export default defineConfig({
  /**
   * 자원을 상대경로로 뽑는다.
   *
   * G2 플러그인으로 설치하면 앱이 file://에서 열려 절대경로(/assets/...)를
   * 찾지 못한다. 상대경로면 relay-service가 루트에서 서빙할 때도 그대로 된다.
   */
  base: './',
  resolve: {
    alias: { '@evenrealities/even_hub_sdk': sdk },
    // 링크된 패키지도 소스로 함께 빌드한다.
    preserveSymlinks: false,
  },
  server: {
    host: true,
    port: 5173,
  },
});
