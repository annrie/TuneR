use std::time::{SystemTime, UNIX_EPOCH};

/// ビルド時点の西暦（UTC）を求めて `BUILD_YEAR` として埋め込む。
/// 著作権表記の年をビルドごとに自動更新するため。
/// 日数→暦への変換は Howard Hinnant の civil_from_days アルゴリズム（誤差なし）。
fn current_year() -> i64 {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0) as i64;
    let days = secs / 86_400;

    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let mut year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    if month <= 2 {
        year += 1;
    }
    year
}

fn main() {
    println!("cargo:rustc-env=BUILD_YEAR={}", current_year());
    tauri_build::build()
}
