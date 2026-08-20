// WebKitのOggライブストリーム対応を実測するワンショットプローブ。
//
// 背景: macOS 15の実測(2026-08-20)では、canPlayType('audio/ogg; codecs="vorbis"')
// は 'probably' を返し、Oggの「ファイル」は再生できるのに、Icecastの無限長
// Oggライブストリームは MEDIA_ERR_SRC_NOT_SUPPORTED(code 4) で拒否された。
// このため src/utils/codecSupport.ts はOgg系を静的に再生不可の初期値としている。
//
// OSアップデート後にこのスクリプトを実行し、vorbis_live が 'canplay' になったら
// WebKitがライブOggに対応した証拠 → codecSupport.ts の LIVE_UNPLAYABLE_PRIOR を
// 見直す(アプリ側は実再生成功でも自動解除されるので、必須ではない)。
//
// 実行: swift scripts/webkit-ogg-probe.swift
// 期待出力例(macOS 15): {"canPlayType_vorbis":"probably","vorbis_live":"error:4","mp3_live":"canplay"}

import WebKit
import AppKit
import Foundation

let html = """
<!doctype html><html><body><script>
  const targets = {
    vorbis_live: "https://listen.moe/stream",
    mp3_live: "https://listen.moe/fallback",
  };
  const results = {
    canPlayType_vorbis: new Audio().canPlayType('audio/ogg; codecs="vorbis"'),
    canPlayType_opus: new Audio().canPlayType('audio/ogg; codecs="opus"'),
  };
  const probe = (name, uri) => new Promise((resolve) => {
    const a = new Audio();
    const done = (outcome) => resolve([name, outcome]);
    a.addEventListener('canplay', () => done('canplay'), { once: true });
    a.addEventListener('error', () => done('error:' + (a.error ? a.error.code : '?')), { once: true });
    setTimeout(() => done('timeout rs=' + a.readyState + ' ns=' + a.networkState), 8000);
    a.preload = 'auto';
    a.src = uri;
    a.load();
  });
  Promise.all(Object.entries(targets).map(([k, v]) => probe(k, v))).then((rs) => {
    for (const [name, outcome] of rs) results[name] = outcome;
    window.__result = JSON.stringify(results);
  });
</script></body></html>
"""

// ウィンドウにホストしないWKWebViewはメディアロード自体を開始しない(実測)ため、
// 不可視のNSWindowを用意する
let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let config = WKWebViewConfiguration()
config.mediaTypesRequiringUserActionForPlayback = []
let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 320, height: 240), configuration: config)

let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 320, height: 240),
                      styleMask: [.titled], backing: .buffered, defer: false)
window.contentView = webView
window.orderBack(nil)

webView.loadHTMLString(html, baseURL: URL(string: "https://localhost/")!)

var polls = 0
func poll() {
    polls += 1
    if polls > 48 { print("TIMEOUT"); exit(1) }
    webView.evaluateJavaScript("window.__result || null") { result, _ in
        if let r = result as? String {
            print(r)
            exit(0)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { poll() }
    }
}
DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { poll() }
app.run()
