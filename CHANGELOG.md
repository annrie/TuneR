# Changelog


## v0.2.1

[compare changes](https://github.com/annrie/TuneR/compare/v0.2.0...v0.2.1)

### 🐛 バグ修正

- **ios:** 🔧 実機release再署名に伴うXcodeプロジェクト設定を同期 ([c432e47](https://github.com/annrie/TuneR/commit/c432e47))
- **ios:** 🐛 スクリプトサンドボックスを無効化しiOSビルドを復旧 ([7b40858](https://github.com/annrie/TuneR/commit/7b40858))
- **player:** 🐛 再生断を検知してバックオフ付き自動再接続する ([a979097](https://github.com/annrie/TuneR/commit/a979097))
- **player:** 🐛 復旧判定を再生位置の実前進に限定しgive-up不達を防ぐ ([3a1f038](https://github.com/annrie/TuneR/commit/3a1f038))
- **csp:** 🐛 非標準ポートのストリーム局が本番で再生できない問題を修正 ([60c6f67](https://github.com/annrie/TuneR/commit/60c6f67))
- **player:** 🐛 停止後の再開失敗を修正し再生不可コーデックの局を除外 ([ef8cff7](https://github.com/annrie/TuneR/commit/ef8cff7))

### 📖 ドキュメント

- **ios:** 📝 旧iOS実機デプロイにios-deploy手順を追記 ([38f5454](https://github.com/annrie/TuneR/commit/38f5454))

### 🧹 ビルドプロセスまたは補助ツールの変更

- 📛 MITライセンスを追加しREADMEにステータスバッジを追加 ([c749c0f](https://github.com/annrie/TuneR/commit/c749c0f))

### ❤️ Contributors

- Annrie ([@annrie](https://github.com/annrie))

## v0.2.0

[compare changes](https://github.com/annrie/TuneR/compare/v0.1.1...v0.2.0)

### 🐛 バグ修正

- **ios:** 🐛 署名チームを設定しiOSビルドの署名エラーを解消 ([736e926](https://github.com/annrie/TuneR/commit/736e926))
- **ios:** 🐛 Externalsをリンク専用にしlibapp.aの重複コピーを解消 ([0bd93f1](https://github.com/annrie/TuneR/commit/0bd93f1))

### 📦 ビルド

- **deps:** ⬆️ vite 8世代へメジャー移行 ([db58c54](https://github.com/annrie/TuneR/commit/db58c54))
- **deps:** 🔧 obug@2.1.4をminimumReleaseAgeExcludeに追加 ([c0e19be](https://github.com/annrie/TuneR/commit/c0e19be))

### ❤️ Contributors

- Annrie ([@annrie](https://github.com/annrie))

## v0.1.1

[compare changes](https://github.com/annrie/TuneR/compare/v0.1.0...v0.1.1)

### 🐛 バグ修正

- 旧WebKit(iOS 15)対応とXcode GUIビルド・実機HMRの修正 ([3ab9edf](https://github.com/annrie/TuneR/commit/3ab9edf))

### 📖 ドキュメント

- READMEを日英併記に変更 ([accb0a5](https://github.com/annrie/TuneR/commit/accb0a5))
- IOS 15実機対応で得た知見をトラブルシューティング表に追記 ([d181ff2](https://github.com/annrie/TuneR/commit/d181ff2))

### 📦 ビルド

- **deps:** ⬆️ tauri 2.11.5ほかminor/patch一括更新 ([bdafb37](https://github.com/annrie/TuneR/commit/bdafb37))
- **release:** 🔧 changelogenによるリリースフローを導入 ([b05c915](https://github.com/annrie/TuneR/commit/b05c915))

### ❤️ Contributors

- Annrie ([@annrie](https://github.com/annrie))

