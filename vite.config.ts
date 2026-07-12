import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import IconsResolver from 'unplugin-icons/resolver'
import postcssMediaMinmax from '@csstools/postcss-media-minmax'
import { fileURLToPath, URL } from 'node:url'

// tauri dev --host 実行時に Tauri CLI が設定する（実機のWebViewが接続してくるLAN IP）
const tauriDevHost = process.env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),
    tailwindcss(),
    Icons({
      compiler: 'vue3',
      autoInstall: true,
    }),
    Components({
      resolvers: [
        IconsResolver({
          prefix: 'Icon',
        }),
      ],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    postcss: {
      plugins: [
        // Tailwind v4 が出力する範囲記法 @media (width >= 48rem) を
        // 旧記法 (min-width: 48rem) に変換する。範囲記法は WebKit 16.4 未満
        // （iOS 15 等）で解釈されず、レスポンシブ指定が全滅するため。
        postcssMediaMinmax(),
      ],
    },
  },
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    hmr: {
      protocol: 'ws',
      // localhost 固定だと実機(iPhone/iPad)からHMRのWebSocketが繋がらず、
      // コード変更が反映されない（アプリ再起動が必要になる）
      host: tauriDevHost || 'localhost',
      port: 3001,
    },
  },
  // Env variables starting with the item of `envPrefix` will be exposed in tauri's source code through `import.meta.env`.
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    // disable module preload to avoid WKWebView issues
    modulePreload: false,
  },
}))
