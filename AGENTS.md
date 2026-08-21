# TuneR — AGENTS.md

> このファイルがプロジェクトのエージェント向け指示の正本です。`CLAUDE.md` はこれをimportしています。

## プロジェクト概要
Tauri v2 (Rust) + Vue 3 (Composition API) + Vite + TypeScript + Pinia で作るデスクトップ/iOS向けインターネットラジオアプリ。アプリ名 **TuneR**（大文字RはRadioのR）。

**重要:** これは旧Nuxt版（`/Volumes/Logitec2/work/Radio/`）からの全面移植版。Nuxtのサーバ前提設計がTauri（静的ファイルのみ）と摩擦を起こしたため純Vueへ移行した。iOS版を予定しているため、ランタイムのサーバ依存は一切持たない方針。

## ディレクトリ構成

```
TuneR/
├── index.html                  # Viteエントリ
├── vite.config.ts              # Vite設定（Vue/Tailwind/unplugin-icons）
├── tsconfig*.json              # TypeScript設定（app/node分割）
├── src/
│   ├── main.ts                 # アプリ初期化（Pinia/router/i18n登録）
│   ├── App.vue                 # ルート。?window=mini で main/mini を切替
│   ├── assets/main.css         # Tailwind v4 + primaryカラー定義
│   ├── router/index.ts         # vue-router（hash mode, 2ルート）
│   ├── i18n/
│   │   ├── index.ts            # vue-i18n設定 + availableLocales
│   │   └── locales/*.json      # 8言語（ja,en,de,es,fr,ko,pt-BR,zh-TW）
│   ├── types/index.ts          # Station型
│   ├── utils/
│   │   ├── radioApi.ts         # Radio Browser API ラッパー
│   │   └── icyMetadata.ts      # Tauri経由のICYメタデータ取得
│   ├── stores/
│   │   ├── usePlayer.ts        # 再生状態（メイン窓が唯一の音源）
│   │   └── useFavorites.ts     # お気に入り（localStorage）
│   ├── composables/
│   │   └── usePlayerBridge.ts  # メイン窓: ミニ窓との player イベント橋渡し
│   ├── components/
│   │   ├── AppHeader.vue       # ナビ・言語/テーマ切替
│   │   ├── SearchBar.vue       # 国セレクター + キーワード検索
│   │   ├── StationCard.vue     # ラジオ局カード
│   │   ├── RadioPlayer.vue     # 固定底部プレイヤーバー
│   │   └── Pagination.vue      # 自作ページネーション
│   └── views/
│       ├── Home.vue            # ホーム（局一覧）
│       ├── Favorites.vue       # お気に入り
│       └── MiniPlayer.vue      # ミニ窓UI（局名/音量/お気に入りselect）
└── src-tauri/                  # Tauri v2 Rust バックエンド
    ├── src/main.rs             # エントリ + fetch_icy_metadata + ミニ窓トグル
    ├── tauri.conf.json         # frontendDist: ../dist
    ├── Info.plist              # ATS設定（HTTPストリーム許可）
    └── Cargo.toml
```

## 技術スタック
- **フレームワーク**: Vue 3 (`<script setup lang="ts">`), Vite 7
- **状態管理**: Pinia
- **ルーティング**: vue-router（**hash mode 必須** — `tauri://` で history mode は動かない）
- **国際化**: vue-i18n（legacy: false / Composition API、デフォルト日本語、8言語）
- **UI**: Tailwind v4 (`@tailwindcss/vite`) + Headless UI + 自作コンポーネント
- **アイコン**: `unplugin-icons` + `@iconify-json/heroicons`（**ビルド時SVG埋め込み**。`~icons/heroicons/xxx` でimport）
- **Tauri**: v2.x, opener plugin
- **音声**: HTML5 Audio API + IcecastMetadataPlayer（メタデータ用、**動的import必須**）
- **API**: Radio Browser API (https://de1.api.radio-browser.info)

## 重要な制約・設計

### Tauri 互換の鉄則
1. **アイコンはビルド時埋め込みのみ** — `unplugin-icons`で`import IconX from '~icons/heroicons/xxx'`。ランタイムのアイコンAPI依存は禁止（旧Nuxt版の最大の地雷だった）
2. **vue-router は hash mode 必須** — `createWebHashHistory()`。`tauri://localhost` で history mode は動かない
3. **IcecastMetadataPlayer は動的import** — モジュール初期化時に `new Worker()` を呼ぶ。WKWebViewは`tauri://`からのWorker生成をSecurityErrorで拒否するため、`play()`内で`await import(...)`
4. **modulePreload無効** — `vite.config.ts` の `build.modulePreload: false`（WKWebViewでのモード不一致防止）
5. **Vite dev は port 3000 / strictPort** — `tauri.conf.json` の `devUrl` と一致させる
6. **HTTPストリーム再生** — `Info.plist` の `NSAllowsArbitraryLoads: true`（macOS ATS対策）。CSPの `media-src`/`img-src`/`connect-src` は素の `*`（+ `data: blob:`）を使う（**WebKitはポートワイルドカード`http://*:*`を尊重せず、`https://*`はデフォルトポートのみ** — 非標準ポート局は `*` でしか通らない）

### ミニプレイヤー設計（重要）
- **メインウィンドウが唯一の音源**（`usePlayerStore` + Audio要素を保持）。ミニ窓は音を持たない
- ミニ窓は Tauri イベントのリモコン:
  - 送信: `player:command`（`sync` / `toggle` / `volume` / `play`）
  - 受信: `player:state`（局/再生状態/nowPlaying/音量/streamStatus）
- これにより **二重再生が原理的に起きない**
- 役割判定は `?window=mini` クエリで**同期的**に行う（`usePlayerBridge`の`onUnmounted`がsetup同期実行を要求するため、async判定は不可）
- Rust側: ミニ窓は `WebviewUrl::App("index.html?window=mini")` で生成。メニュー項目はapp stateに保持し、表示中の窓に応じて `set_text` で「ミニプレイヤー / メインウィンドウ」を切替

### カラーモード
- `App.vue` の単一 `useColorMode`（`attribute: 'class'`, `selector: 'html'`）が `<html>` に `dark` クラスを適用
- `AppHeader.vue` は `useStorage('tuner-color-mode')` で**ユーザー設定値（auto/light/dark）**を直接トグル
- **注意**: `useColorMode().value` は解決後モード（light/dark）を返し auto に戻れない。設定値が必要な箇所では `.store` か `useStorage` を使う

### ビルドフロー
- **開発**: `pnpm tauri dev` → `pnpm dev`（Vite: port 3000）→ Tauri webview接続
- **ビルド**: `pnpm tauri build` → `pnpm build`（`vue-tsc --noEmit && vite build` → `dist/`）→ Tauriがバンドル
- **リリース**: `pnpm tauri build --target universal-apple-darwin`（Intel + Apple Silicon）

### iOS版（Tauri v2 mobile）
- **Rustはライブラリ構成が必須**: `src/lib.rs` に `#[cfg_attr(mobile, tauri::mobile_entry_point)] pub fn run()` を置き、`main.rs` は `tuner_lib::run()` を呼ぶだけ。`Cargo.toml` に `[lib] name = "tuner_lib", crate-type = ["staticlib", "cdylib", "rlib"]` が必要
- **デスクトップ専用コードは `#[cfg(desktop)]` で隔離**: メニュー（`MenuBuilder`等）・複数ウィンドウ（ミニ窓）・`tauri::Manager` import はiOSでコンパイル不可。`setup` 内も `#[cfg(desktop)] setup_desktop(_app)?;` でガード
- **iOS Info.plist**: `src-tauri/gen/apple/tuner_iOS/Info.plist` に `NSAppTransportSecurity > NSAllowsArbitraryLoads`（HTTPストリーム）と `UIBackgroundModes: [audio]`（ロック中/バックグラウンド再生）を追加。`gen/apple/` はコミット対象で `tauri ios init` 再実行時も既存ファイルは上書きされない
- **前提環境**: Xcode、iOS Rustターゲット（`aarch64-apple-ios` / `-sim` / `x86_64-apple-ios`）、CocoaPods
- **コマンド**: 初期化 `pnpm tauri ios init`（`gen/apple/tuner.xcodeproj` 生成）、開発 `pnpm tauri ios dev`（シミュレータ起動）、ビルド `pnpm tauri ios build`（実機は要Apple Developer account署名）
- **コンパイル検証のみ**: `cargo build --target aarch64-apple-ios-sim --lib`（Xcode/署名なしでRust側だけ確認）
- **ミニプレイヤーはiOSで無効**: 単一ウィンドウのため。`?window=mini` 判定は常にfalseになり実害なし。iOS向けの簡易プレイヤーUXは将来課題

## コーディング規約
- TypeScript必須（`.ts`, `.vue` の `<script setup lang="ts">`）
- Composition API + `<script setup>` スタイル
- コンポーネントは `PascalCase`、composableは `useXxx`、Piniaストアは `useXxxStore`
- i18nキーは `snake_case`
- `@/` は `src/` を指す（vite alias）
- 自動importは使わない（明示的にimportを書く）

## タスク規模の判断
- **大（複数ファイル変更）**: Plan → 実装 → 動作確認
- **中（単一機能）**: 実装 → 動作確認
- **小（軽微な修正）**: 即時対応

## よくある問題と解決策

| 症状 | 原因 | 解決策 |
|------|------|--------|
| アイコンが表示されない | ランタイムAPI依存 | `unplugin-icons`でビルド時埋め込み（`~icons/heroicons/xxx`） |
| `tauri build` で白画面 | history mode router | `createWebHashHistory()` を使う |
| 起動時に白画面 | Worker生成エラー | IcecastMetadataPlayerを`play()`内で動的import |
| カラーモードが auto に戻らない | `useColorMode().value`が解決後モードを返す | `useStorage`/`.store`で設定値を扱う |
| HTTPストリームが鳴らない | macOS ATS | `Info.plist`の`NSAllowsArbitraryLoads` + CSPの`media-src *` |
| 局のfaviconが出ない | CSP/壊れたURL | CSPに`img-src * data: blob:` |
| ミニ窓で二重に音が鳴る | ミニ窓が独自に再生 | ミニ窓は`player:command`送信のみ。音源はメイン窓だけ |
| 非標準ポート局（`:3330`/`:8000`等）が本番だけ再生不可 | CSPの`https://*`は**デフォルトポートにしかマッチしない**（CSP仕様）うえ、ポートワイルドカード`http://*:*`は**WebKitが尊重しない**（実測）。devはVite dev server経由でCSP差分に気づけない | media-src/img-src/connect-srcに素の`*`を付与（tauri.conf.json設定済み）。切り分けにはエラー表示のEコード（E2=NETWORK/E4=SRC_NOT_SUPPORTED）を見る |
| 一時停止→（スリープ等を挟み）同じ局を再生すると「接続が切れました」になる。別の局を経由すると直る | 同一URLをsrcに再代入しても、要素内に残った古いリソース状態（死んだ接続・リダイレクト解決結果）が再利用される | `play()`でsrcを一旦外し`load()`で破棄してから張り直す（`usePlayer.ts`対応済み） |
| Vorbis/Opus局（Listen.Moe Vorbis等）がE4で再生できない | WebKitはOggの**ファイル**再生に対応していても（macOS 15実測: canPlayTypeは`'probably'`、data URIのOggはcanplay）、Icecastの**無限長Oggライブストリーム**はSRC_NOT_SUPPORTEDで拒否する。つまりcanPlayTypeもファイルprobeもライブ可否を検知できない | `codecSupport.ts`がOgg系を静的に再生不可の初期値とし、StationCardに「非対応」バッジを表示（**一覧からの除外はしない**）。**実再生の成功（再生位置の実前進）でバッジを解除しlocalStorageに永続化** — ライブOgg対応のWebKitでは最初に鳴った時点で自動解除される。OSアップデート後の再実測は `swift scripts/webkit-ogg-probe.swift` |
| 再生が無音のまま「再生中」表示で固まる | WKWebViewは接続断時に`error`/`ended`を発火せず黙って停止することがある（Zeno.FM系中継局で頻発） | `timeupdate`停滞のストールウォッチドッグ→バックオフ付き自動再接続（`usePlayer.ts`）。5回失敗で`streamStatus: error`＝「接続が切れました」表示に落とす |
| ミニプレイヤー運用中に「再接続中…」のまま永久に固まる（メインウィンドウを表示すると即復旧するのが特徴） | ストリーム断で音が止まると audible 免除が消え、WebKitが**非表示のメイン窓のページをサスペンド**→バックオフや監視のJSタイマーが全停止して状態機械が凍結する（アプリ活性化では解けない可視性駆動のサスペンド。2026-08-21実測） | `'reconnecting'`の間だけ±1LSBの不可聴WAVループを再生して audible を維持＋表示復帰(`visibilitychange`)時に凍結を検知したら即時再接続（`usePlayer.ts`対応済み） |
| 一部の局で曲名が出ない | 局のCORS `Access-Control-Allow-Headers` に `Icy-Metadata` が無く、IcecastMetadataPlayerが**エラーを出さずに**HTML5再生へ内部縮退（メタデータゼロ） | 10秒ウォッチドッグでRustフォールバックのポーリングを起動（`usePlayer.ts`） |
| 曲名が先頭数文字で切れる | ICYの`StreamTitle`はエスケープ機構がなく、曲名内のアポストロフィ（`You're`等）で誤終端 | パーサは `';` 終端を優先（`lib.rs` の `parse_stream_title`、ユニットテストあり） |
| iOS実機でJS/曲名まわりを検証したい | ブラウザでdev URLを開いてもRust（invoke）が無い別環境になり検証にならない | 必ずアプリ本体で確認。Mac Safariの「開発」メニュー → 実機 → TuneRのWebViewでコンソールを見る |
| `devicectl ... exited with code 1` で実機起動失敗 | iPhoneがロック中、または開発者未信頼 | ロック解除して再実行。初回は 設定→一般→VPNとデバイス管理 で開発者を「信頼」 |
| 旧iOS(15等)でprimary色が透明になる | oklchの明度の小数表記はWebKit 16.4未満でパース不可 | `main.css` は**パーセント表記**（`oklch(67.3% …)`）を維持する |
| 旧iOSでレスポンシブ(`md:`等)が全滅 | Tailwind v4の範囲記法 `@media (width >= …)` は WebKit 16.4未満で無効 | `@csstools/postcss-media-minmax` で旧記法に変換（vite.config.ts設定済み） |
| 実機dev中にコード変更が反映されない | HMRのWebSocketがlocalhost固定で実機から届かない | `hmr.host` は `TAURI_DEV_HOST` を優先（vite.config.ts設定済み）。修正前のセッションはアプリ再起動で反映 |
| Xcode GUIから▶で `pnpm: command not found` | GUI起動のXcodeはターミナルのPATHを継がない | ビルドスクリプト先頭でPATHをexport（project.yml/pbxproj設定済み） |
| `failed to read project.pbxproj: Operation not permitted (os error 1)` でexit 65（Rustのコンパイルは成功した直後に落ちる） | `ENABLE_USER_SCRIPT_SANDBOXING = YES`。`Build Rust Code`フェーズ（`tauri ios xcode-script`）がpbxprojを読むが、これはinputFilesに宣言できないためsandbox-execが`file-read-data`を拒否する。**Xcode GUIの「Update to recommended settings」がYESに戻す**（2026-07-29に混入し、以後のiOSビルドが全滅した） | `project.yml`と`project.pbxproj`の両方に`ENABLE_USER_SCRIPT_SANDBOXING: false`（設定済み）。`os error 1`はEPERM＝MACポリシー拒否で、通常のパーミッション不足`EACCES(13)`とは別物。`ls -l`が正常ならパーミッションを疑わず`log show --predicate 'eventMessage CONTAINS "deny"'`でカーネルのsandbox violationを見る |
| ipaインストールが`0xe8008015`で弾かれる | 無料Personal Teamのプロファイルは**登録済みUDIDのリスト**を内包する。ビルド時に未接続だった実機は含まれない | 対象実機を接続した状態で`pnpm tauri ios build --export-method debugging`を回す（`-allowProvisioningUpdates`がXcodeに自動登録させる）。確認は`security cms -D -i Payload/TuneR.app/embedded.mobileprovision`の`ProvisionedDevices`。なお有効期限内のプロファイルは**再発行されず使い回される**ので、再署名しても失効日は延びない |
| iOS 15実機(旧iPad等)へのデプロイ | `devicectl`はCoreDevice(iOS 17+)しか列挙せず`ERROR: The specified device was not found`になる | Xcode GUI: `pnpm tauri ios dev --open --host` で開き実行先に実機を選んで▶。CLIのみで済ませたい場合は`brew install ios-deploy`を使う(usbmuxd/MobileDevice経由でiOS 15でも動く)。`pnpm tauri ios build`でIPA生成後、`unzip`で`Payload/*.app`を取り出し`ios-deploy --id <UDID> --bundle <path>.app --justlaunch`。UDIDは`ios-deploy -c`または`xcrun xctrace list devices`で確認(devicectlの表示UDIDとは別形式) |
| iOSで音量スライダーが効かない | iOS/iPadOSは `audio.volume` への書き込みをOS仕様で無視 | 仕様。音量は本体ボタンで調整（iOSでは音量UI非表示が望ましい・将来課題） |
