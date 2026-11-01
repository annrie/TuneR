#!/bin/bash
# iOS 実機用 IPA の再署名スクリプト（無料 Personal Team 向け）
#
# 背景:
#   無料 Apple ID の署名プロファイルは 7 日で失効する。`tauri ios build --export-method debugging` は
#   有効期限内のプロファイルを使い回すため、失効前にビルドしても期限は延びない。
#   そこで、いまのプロファイルの失効時刻を跨いでからビルドし直し、iPad → iPhone の順に入れる。
#   失効と同時に Apple 側のデバイス登録リストが消えることもある（「Your team has no devices」）。
#   その場合は止まって復旧手順を表示するので、登録してから --no-wait で再実行する。
#
# 使い方:
#   scripts/ios-resign.sh             失効を跨ぐまで待つ → ビルド → インストール
#   scripts/ios-resign.sh --no-wait   待たずにすぐビルドする（すでに失効している場合、登録後の再実行など）
#   scripts/ios-resign.sh --expires 2026-11-08T12:24:34Z   失効時刻（UTC）を直接指定する
#   scripts/ios-resign.sh --dry-run   設定と失効時刻の解釈だけ表示して終了（ビルド・インストールはしない）
#
# 対象デバイス（個人の識別子なのでリポジトリには置かない。*.local は .gitignore 済み）:
#   scripts/ios-devices.local に次のように書くか、同名の環境変数で渡す。未設定のデバイスは飛ばす。
#     TUNER_IPAD_UDID=<iPad の UDID>      # `ios-deploy -c` で確認（iOS 15 は devicectl が使えないので ios-deploy）
#     TUNER_IPHONE_UDID=<iPhone の UDID>  # `xcrun xctrace list devices` で確認（devicectl で入れる）
#
# 調整用の環境変数（任意）:
#   TUNER_RESIGN_MARGIN=30           失効後に待つ余裕（秒）
#   TUNER_RESIGN_IPHONE_TRIES=6      iPhone の devicectl を試す回数（接続エラーが出やすい）
#   TUNER_RESIGN_IPHONE_INTERVAL=120 iPhone の再試行の間隔（秒）
#
# 実行中は両デバイスを USB でつなぎ、画面ロックを解除しておく。ログと状態は一時ディレクトリに残る。

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
REPO=$(cd "$SCRIPT_DIR/.." && pwd -P)
APPLE_DIR=$REPO/src-tauri/gen/apple
IPA=$APPLE_DIR/build/arm64/TuneR.ipa
APP_IN_IPA=Payload/TuneR.app
BUNDLE_ID=com.radio.tuner
MIN_VALID_DAYS=6   # 新しいプロファイルの失効がこれより近ければ「使い回された」と判断して中断する

# shellcheck disable=SC1091
[ -f "$SCRIPT_DIR/ios-devices.local" ] && . "$SCRIPT_DIR/ios-devices.local"
IPAD=${TUNER_IPAD_UDID:-}
IPHONE=${TUNER_IPHONE_UDID:-}
MARGIN=${TUNER_RESIGN_MARGIN:-30}
IPHONE_TRIES=${TUNER_RESIGN_IPHONE_TRIES:-6}
IPHONE_INTERVAL=${TUNER_RESIGN_IPHONE_INTERVAL:-120}

WAIT=1
DRY=0
EXPIRES_ISO=
while [ $# -gt 0 ]; do
  case "$1" in
    --no-wait) WAIT=0 ;;
    --dry-run) DRY=1 ;;
    --expires)
      shift
      EXPIRES_ISO=${1:-}
      [ -n "$EXPIRES_ISO" ] || { echo "--expires に値がありません" >&2; exit 2; }
      ;;
    -h|--help) sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "不明な引数: $1" >&2; exit 2 ;;
  esac
  shift
done

WORK=$(mktemp -d "${TMPDIR:-/tmp}/tuner-resign.XXXXXX") || exit 1
LOG=$WORK/resign.log
say()    { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }
status() { echo "$*" > "$WORK/status"; }

iso_to_epoch() { date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$1" +%s 2>/dev/null; }

# IPA に埋め込まれたプロファイルの失効時刻（UTC, ISO 8601）を標準出力へ
ipa_profile_expiry() {
  local ipa=$1 tmp=$WORK/probe
  mkdir -p "$tmp"
  unzip -p "$ipa" "$APP_IN_IPA/embedded.mobileprovision" > "$tmp/emb.mobileprovision" 2>/dev/null || return 1
  security cms -D -i "$tmp/emb.mobileprovision" -o "$tmp/prof.plist" 2>/dev/null || return 1
  plutil -extract ExpirationDate raw "$tmp/prof.plist" 2>/dev/null
}

[ -f "$APPLE_DIR/project.yml" ] || { say "TuneR の src-tauri/gen/apple が見つかりません (REPO=$REPO)"; status "FAIL:wrong-repo"; exit 1; }
say "作業ディレクトリ: $WORK"

# --- 失効時刻の決定 ---
EXP=
if [ "$WAIT" -eq 1 ]; then
  if [ -z "$EXPIRES_ISO" ]; then
    EXPIRES_ISO=$(ipa_profile_expiry "$IPA") || EXPIRES_ISO=
  fi
  EXP=$(iso_to_epoch "$EXPIRES_ISO")
  if [ -z "$EXP" ]; then
    say "失効時刻を決められません（既存の IPA が無い、または --expires の形式が違います: '$EXPIRES_ISO'）"
    say "--expires 2026-11-08T12:24:34Z のように UTC で指定するか、待たずに進めるなら --no-wait を付けてください"
    status "FAIL:no-expiry"
    exit 1
  fi
  say "失効時刻: ${EXPIRES_ISO}（$(date -r "$EXP" '+%F %T %Z')）。失効の ${MARGIN} 秒後までビルドを待ちます"
else
  say "--no-wait: 待たずに進みます"
fi

if [ "$DRY" -eq 1 ]; then
  say "[dry-run] リポジトリ: $REPO"
  say "[dry-run] iPad (TUNER_IPAD_UDID): $([ -n "$IPAD" ] && echo 設定あり || echo 未設定)"
  say "[dry-run] iPhone (TUNER_IPHONE_UDID): $([ -n "$IPHONE" ] && echo 設定あり || echo 未設定)"
  if [ -n "$EXP" ]; then
    say "[dry-run] 待機時間: $(( EXP + MARGIN - $(date +%s) )) 秒（負なら待たずに進む）"
  fi
  say "[dry-run] ここで終了します（ビルド・インストールはしません）"
  exit 0
fi

# スリープや外付けボリュームの切断を防ぐ（このスクリプトが生きている間だけ）
caffeinate -ims -w $$ &

if [ "$WAIT" -eq 1 ]; then
  status "WAITING"
  while [ "$(date +%s)" -lt $((EXP + MARGIN)) ]; do sleep 5; done
  say "失効を跨ぎました"
fi

# --- ビルド ---
cd "$REPO" || { say "cd 失敗: $REPO"; status "FAIL:cd"; exit 1; }
status "BUILDING"
say "ビルド開始: pnpm tauri ios build --export-method debugging"
OLD_MTIME=$(stat -f %m "$IPA" 2>/dev/null || echo 0)
pnpm tauri ios build --export-method debugging > "$WORK/build.log" 2>&1
BRC=$?
NEW_MTIME=$(stat -f %m "$IPA" 2>/dev/null || echo 0)
say "ビルド終了 rc=${BRC}（IPA の更新時刻: ${OLD_MTIME} → ${NEW_MTIME}）"

if [ "$BRC" -ne 0 ] || [ "$NEW_MTIME" -le "$OLD_MTIME" ]; then
  if grep -qi 'has no devices' "$WORK/build.log"; then
    say "デバイス登録リストが消えています。iPad → iPhone の順に、1 台ずつ実機を指定して登録してください:"
    for u in "$IPAD" "$IPHONE"; do
      [ -n "$u" ] && say "  (cd $APPLE_DIR && xcodebuild -project tuner.xcodeproj -scheme tuner_iOS -configuration release -destination 'platform=iOS,id=$u' -allowProvisioningUpdates -allowProvisioningDeviceRegistration build)"
    done
    say "どちらも Build Rust Code で失敗しますが、署名・登録はその手前で終わっているので問題ありません"
    say "登録できたら scripts/ios-resign.sh --no-wait で再実行してください"
    status "FAIL:no-devices"
  else
    say "ビルドに失敗しました。ログ末尾 ($WORK/build.log):"
    tail -25 "$WORK/build.log" | tee -a "$LOG"
    status "FAIL:build"
  fi
  exit 1
fi

# --- 新しいプロファイルが本当に再発行されたかを確認（使い回しなら期限は延びない）---
NEW_EXP_ISO=$(ipa_profile_expiry "$IPA") || NEW_EXP_ISO=
NEW_EXP=$(iso_to_epoch "$NEW_EXP_ISO")
if [ -z "$NEW_EXP" ] || [ "$NEW_EXP" -lt $(( $(date +%s) + MIN_VALID_DAYS * 86400 )) ]; then
  say "プロファイルが再発行されていません（新しい失効: '${NEW_EXP_ISO:-不明}'）。インストールせず中断します"
  say "失効時刻を跨いでいるか確認してください（--no-wait を付けていたなら、まだ有効なプロファイルが使い回されています）"
  status "FAIL:profile-reused"
  exit 1
fi
say "新プロファイルの失効: ${NEW_EXP_ISO}（$(date -r "$NEW_EXP" '+%F %T %Z')）"
for u in "$IPAD" "$IPHONE"; do
  [ -n "$u" ] && ! grep -q "$u" "$WORK/probe/prof.plist" && say "警告: UDID $u がプロファイルに入っていません（その機へのインストールは失敗する見込み）"
done

# --- インストール ---
status "INSTALLING"
FAILED=0
IPAD_RES=skip
IPHONE_RES=skip

if [ -n "$IPAD" ]; then
  if ! command -v ios-deploy >/dev/null 2>&1; then
    IPAD_RES="NG(ios-deploy が無い: brew install ios-deploy)"
  else
    D=$WORK/ipa-unzip
    mkdir -p "$D" && unzip -q -o "$IPA" -d "$D"
    T=; command -v timeout >/dev/null 2>&1 && T="timeout 300"
    # ios-deploy は lldb の終了の影響で、成功しても rc=1 になることがある。出力で判定する
    # shellcheck disable=SC2086
    out=$($T ios-deploy --id "$IPAD" --bundle "$D/$APP_IN_IPA" --justlaunch 2>&1); rc=$?
    echo "$out" >> "$LOG"
    if echo "$out" | grep -qE 'Installed package|^success$'; then IPAD_RES=OK; else IPAD_RES="NG(rc=$rc)"; fi
  fi
  say "iPad: $IPAD_RES"
  [ "$IPAD_RES" = OK ] || FAILED=1
fi

if [ -n "$IPHONE" ]; then
  IPHONE_RES=NG
  i=1
  while [ "$i" -le "$IPHONE_TRIES" ]; do
    out=$(xcrun devicectl device install app --device "$IPHONE" "$IPA" 2>&1); rc=$?
    echo "$out" >> "$LOG"
    if [ "$rc" -eq 0 ]; then IPHONE_RES=OK; break; fi
    say "iPhone: 試行 $i/$IPHONE_TRIES 失敗 (rc=$rc)"
    i=$((i + 1))
    [ "$i" -le "$IPHONE_TRIES" ] && { say "${IPHONE_INTERVAL} 秒後に再試行します（連続で試すより間隔を空けたほうが通りやすい）"; sleep "$IPHONE_INTERVAL"; }
  done
  say "iPhone: $IPHONE_RES"
  if [ "$IPHONE_RES" = OK ]; then
    xcrun devicectl device info apps --device "$IPHONE" --bundle-id "$BUNDLE_ID" 2>&1 | tee -a "$LOG"
  else
    FAILED=1
  fi
fi

if [ -z "$IPAD" ] && [ -z "$IPHONE" ]; then
  say "対象デバイスが未設定のため、インストールは行いませんでした（scripts/ios-devices.local を参照）"
fi

say "git 差分（空なら変更なし）:"; git -C "$REPO" status --short | tee -a "$LOG"
status "DONE ipad=$IPAD_RES iphone=$IPHONE_RES profile_exp=$NEW_EXP_ISO"
say "完了: $(cat "$WORK/status")（ログ: ${LOG}）"
exit "$FAILED"
