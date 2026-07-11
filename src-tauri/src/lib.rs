use futures_util::StreamExt;

// ── デスクトップ専用（メニュー・ミニウィンドウ） ──
// iOS/Android はメニューバーも複数ウィンドウも持たないため隔離する。
#[cfg(desktop)]
use tauri::{
    image::Image,
    menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Manager,
};

#[cfg(desktop)]
const MENU_LABEL_TO_MINI: &str = "ミニプレイヤー";
#[cfg(desktop)]
const MENU_LABEL_TO_MAIN: &str = "メインウィンドウ";

// ミニ/メイン切替メニュー項目を保持して、表示中の窓に応じて文言を書き換える
#[cfg(desktop)]
struct MenuItems {
    mini: tauri::menu::MenuItem<tauri::Wry>,
}

#[cfg(desktop)]
fn toggle_mini_main(app: &tauri::AppHandle) {
    let menu_items = app.state::<MenuItems>();

    // ミニウィンドウが既に存在する → メインを先に表示してからミニを閉じる
    if let Some(mini_win) = app.get_webview_window("mini") {
        if let Some(main_win) = app.get_webview_window("main") {
            let _ = main_win.show();
            let _ = main_win.set_focus();
        }
        let _ = mini_win.close();
        let _ = menu_items.mini.set_text(MENU_LABEL_TO_MINI);
        return;
    }

    // メインウィンドウを隠す
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.hide();
    }

    // ミニウィンドウを作成
    let app_clone = app.clone();
    if let Ok(mini_win) = tauri::WebviewWindowBuilder::new(
        app,
        "mini",
        tauri::WebviewUrl::App("index.html?window=mini".into()),
    )
    .title("TuneR Mini")
    .inner_size(380.0, 180.0)
    .resizable(false)
    .always_on_top(true)
    .build()
    {
        // ミニ窓表示中はメニュー文言を「メインウィンドウ」に
        let _ = menu_items.mini.set_text(MENU_LABEL_TO_MAIN);

        // ミニウィンドウが閉じたらメインウィンドウを復元し、文言を戻す
        let _ = mini_win.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                if let Some(main) = app_clone.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }
                let items = app_clone.state::<MenuItems>();
                let _ = items.mini.set_text(MENU_LABEL_TO_MINI);
            }
        });
    }
}

#[cfg(desktop)]
fn setup_desktop(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let mini_item = MenuItemBuilder::new(MENU_LABEL_TO_MINI)
        .id("mini_player")
        .accelerator("CmdOrCtrl+Shift+M")
        .build(app)?;

    // 文言を後から書き換えるためにメニュー項目を保持
    app.manage(MenuItems {
        mini: mini_item.clone(),
    });

    // About画面: アイコン(ビルド時埋め込み)・著者・著作権を設定。
    // 著作権の年は build.rs が埋め込む BUILD_YEAR でビルドごとに自動更新。
    let about = AboutMetadata {
        name: Some("TuneR".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        authors: Some(vec!["annrie".into()]),
        copyright: Some(format!("© {} phantomoon", env!("BUILD_YEAR"))),
        icon: Image::from_bytes(include_bytes!("../icons/128x128.png")).ok(),
        ..Default::default()
    };

    let tuner_menu = SubmenuBuilder::new(app, "TuneR")
        .about(Some(about))
        .separator()
        .item(&mini_item)
        .separator()
        .quit()
        .build()?;

    let menu = MenuBuilder::new(app).item(&tuner_menu).build()?;
    app.set_menu(menu)?;

    app.on_menu_event(|app, event| {
        if event.id().0 == "mini_player" {
            toggle_mini_main(app);
        }
    });

    Ok(())
}

#[tauri::command]
async fn fetch_icy_metadata(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("Icy-Metadata", "1")
        .header("User-Agent", "TuneR/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let icy_metaint: usize = response
        .headers()
        .get("icy-metaint")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    if icy_metaint == 0 {
        return Ok(String::new());
    }

    let needed = icy_metaint + 4081;
    let mut buffer: Vec<u8> = Vec::with_capacity(needed);
    let mut stream = response.bytes_stream();

    while buffer.len() < needed {
        match stream.next().await {
            Some(Ok(chunk)) => buffer.extend_from_slice(&chunk),
            _ => break,
        }
    }

    if buffer.len() <= icy_metaint {
        return Ok(String::new());
    }

    let meta_len = buffer[icy_metaint] as usize * 16;
    if meta_len == 0 || buffer.len() < icy_metaint + 1 + meta_len {
        return Ok(String::new());
    }

    let meta_text = String::from_utf8_lossy(&buffer[icy_metaint + 1..icy_metaint + 1 + meta_len]);

    Ok(parse_stream_title(&meta_text))
}

// ICYメタデータにはエスケープ機構がなく曲名自体に「'」が含まれうるため、
// 終端は「';」を優先し、無ければ最後の「'」までを曲名とみなす。
fn parse_stream_title(meta_text: &str) -> String {
    if let Some(start) = meta_text.find("StreamTitle='") {
        let rest = &meta_text[start + 13..];
        if let Some(end) = rest.find("';").or_else(|| rest.rfind('\'')) {
            return rest[..end].trim().to_string();
        }
    }
    String::new()
}

#[cfg(test)]
mod tests {
    use super::parse_stream_title;

    #[test]
    fn plain_title() {
        assert_eq!(
            parse_stream_title("StreamTitle='Song - Artist';\0\0\0"),
            "Song - Artist"
        );
    }

    // アポストロフィ入り曲名（Classic Vinyl HD で実際に配信されていた形式）
    #[test]
    fn title_with_apostrophe() {
        let meta = "StreamTitle='You're A Sweetheart by Gordon MacRae - Classic Vinyl on walmradio.com';\0\0";
        assert_eq!(
            parse_stream_title(meta),
            "You're A Sweetheart by Gordon MacRae - Classic Vinyl on walmradio.com"
        );
    }

    #[test]
    fn empty_title() {
        assert_eq!(parse_stream_title("StreamTitle='';\0"), "");
    }

    #[test]
    fn no_stream_title() {
        assert_eq!(parse_stream_title("StreamUrl='http://x';\0"), "");
    }

    // 終端の「';」が無い不正データでも panic しないこと
    #[test]
    fn unterminated_title() {
        assert_eq!(parse_stream_title("StreamTitle='abc"), "");
    }
}

// モバイル(iOS/Android)のエントリポイント。デスクトップでは main() から呼ばれる。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![fetch_icy_metadata])
        .setup(|_app| {
            // デスクトップのみメニュー/ミニ窓をセットアップ
            #[cfg(desktop)]
            setup_desktop(_app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
