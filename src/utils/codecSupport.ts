import { ref } from 'vue'
import type { Station } from '../types'

// 「この環境で再生できないコーデック」の判定。
//
// canPlayType()は「''＝不可」の方向しか信頼できない。macOS 15の実測
// (2026-08-20)では canPlayType('audio/ogg; codecs="vorbis"') は 'probably' を
// 返し、data URIのOggファイルも canplay になるが、Icecastの無限長Oggライブ
// ストリーム(listen.moe/stream、Content-Type: audio/ogg)は
// MEDIA_ERR_SRC_NOT_SUPPORTED で拒否される。つまり「ファイル対応」と
// 「ライブストリーム対応」は別物で、後者は事前プローブで検知できない。
// 再実測の手順は scripts/webkit-ogg-probe.swift を参照。
//
// そこでOgg系はライブ再生不可を静的な初期値とし、実際の再生成功
// （唯一信頼できるシグナル）で解除して永続化する。新しいWebKitがライブOggに
// 対応した環境では、最初にOgg局が鳴った時点でバッジが消え、以後表示されない。
const LIVE_UNPLAYABLE_PRIOR = ['OGG', 'VORBIS', 'OPUS']

// canPlayTypeの「''＝不可」判定で検出するコーデック
const CODEC_MIME_CANDIDATES: Record<string, string[]> = {
  WMA: ['audio/x-ms-wma'],
}

// 実再生成功で「再生できる」と確定したラベルの永続化キー
const STORAGE_KEY = 'tuner-playable-codecs'

const loadConfirmedPlayable = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : []
  } catch {
    return []
  }
}

const initialUnplayable = (): string[] => {
  const byProbe = (() => {
    if (typeof Audio === 'undefined') return []
    const probe = new Audio()
    return Object.entries(CODEC_MIME_CANDIDATES)
      .filter(([, mimes]) => mimes.every(mime => probe.canPlayType(mime) === ''))
      .map(([codec]) => codec)
  })()
  const confirmed = loadConfirmedPlayable()
  return [...new Set([...LIVE_UNPLAYABLE_PRIOR, ...byProbe])]
    .filter(codec => !confirmed.includes(codec))
}

const unplayableCodecs = ref<string[]>(initialUnplayable())

export const isUnplayableStation = (s: Station) =>
  unplayableCodecs.value.some(c => (s.codec ?? '').toUpperCase().includes(c))

// 再生位置の実前進が確認できた局のコーデックは「この環境では再生できる」と
// 確定できる。静的初期値より実挙動を優先し、解除を永続化する
export const markStationPlayable = (s: Station) => {
  const codec = (s.codec ?? '').toUpperCase()
  if (!codec) return
  const cleared = unplayableCodecs.value.filter(c => codec.includes(c))
  if (cleared.length === 0) return
  unplayableCodecs.value = unplayableCodecs.value.filter(c => !codec.includes(c))
  try {
    const confirmed = new Set([...loadConfirmedPlayable(), ...cleared])
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...confirmed]))
  } catch {
    // localStorage不可でもセッション内の解除は維持される
  }
}
