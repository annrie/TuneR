import type { Station } from '../types'

const BASE_URL = 'https://de1.api.radio-browser.info/json'

// 実行環境のWebKitが再生できないコーデックの局は、リストに出しても
// 必ず失敗するため一覧・検索結果から除外する。静的リストではなく
// canPlayType()で実行時判定し、OSのコーデック対応拡大に自動追随する。
// Radio BrowserはOgg容器の局（Vorbis/Opus）を codec='OGG' と報告する
const CODEC_MIME_CANDIDATES: Record<string, string> = {
  OGG: 'audio/ogg; codecs="vorbis"',
  VORBIS: 'audio/ogg; codecs="vorbis"',
  OPUS: 'audio/ogg; codecs="opus"',
  WMA: 'audio/x-ms-wma',
}

// canPlayTypeは ''（不可）/'maybe'/'probably' を返す。空文字のものだけ除外
const unplayableCodecs: string[] = (() => {
  if (typeof Audio === 'undefined') return []
  const probe = new Audio()
  return Object.entries(CODEC_MIME_CANDIDATES)
    .filter(([, mime]) => probe.canPlayType(mime) === '')
    .map(([codec]) => codec)
})()

const isPlayableStation = (s: Station) =>
  !unplayableCodecs.some(c => (s.codec ?? '').toUpperCase().includes(c))

const jpCountryMap: Record<string, string> = {
  '日本': 'Japan',
  'アメリカ': 'United States',
  '米国': 'United States',
  'イギリス': 'United Kingdom',
  '英国': 'United Kingdom',
  'フランス': 'France',
  'ドイツ': 'Germany',
  'イタリア': 'Italy',
  'スペイン': 'Spain',
  '韓国': 'South Korea',
  '台湾': 'Taiwan',
  '中国': 'China',
  'ロシア': 'Russia',
  'ブラジル': 'Brazil',
  'オーストラリア': 'Australia',
  'カナダ': 'Canada'
}

export const radioApi = {
  async getCountries() {
    try {
      const res = await fetch(`${BASE_URL}/countries`)
      if (!res.ok) return []
      const data = await res.json()
      return data
        .filter((c: any) => c.name && c.name.trim() !== '')
        .sort((a: any, b: any) => b.stationcount - a.stationcount)
    } catch (error) {
      console.error('Failed to fetch countries:', error)
      return []
    }
  },

  async searchStations(query: string, country: string = '', limit = 500): Promise<Station[]> {
    try {
      const isCountry = jpCountryMap[query]

      const fetchApi = async (params: Record<string, string>) => {
        const url = new URL(`${BASE_URL}/stations/search`)
        for (const [k, v] of Object.entries(params)) {
          url.searchParams.append(k, v)
        }
        url.searchParams.append('limit', limit.toString())
        url.searchParams.append('hidebroken', 'true')
        url.searchParams.append('order', 'votes')
        url.searchParams.append('reverse', 'true')
        const res = await fetch(url.toString())
        if (!res.ok) return []
        return (await res.json() as Station[]).filter(isPlayableStation)
      }

      if (isCountry) {
        return await fetchApi({ country: isCountry })
      }

      if (country && !query) {
        return await fetchApi({ country })
      }

      const searchParams1: Record<string, string> = { name: query }
      const searchParams2: Record<string, string> = { tag: query }

      if (country) {
        searchParams1.country = country
        searchParams2.country = country
      }

      const [nameResults, tagResults] = await Promise.all([
        fetchApi(searchParams1),
        fetchApi(searchParams2)
      ])

      const merged = [...nameResults, ...tagResults]
      const unique = Array.from(new Map(merged.map(item => [item.stationuuid, item])).values())

      return unique.sort((a, b) => b.votes - a.votes).slice(0, limit)

    } catch (error) {
      console.error('Failed to fetch stations:', error)
      return []
    }
  },

  async getTopStations(limit = 500, country: string = ''): Promise<Station[]> {
    try {
      let url = `${BASE_URL}/stations/topvote/${limit}?hidebroken=true`

      if (country) {
        const searchUrl = new URL(`${BASE_URL}/stations/search`)
        searchUrl.searchParams.append('country', country)
        searchUrl.searchParams.append('limit', limit.toString())
        searchUrl.searchParams.append('hidebroken', 'true')
        searchUrl.searchParams.append('order', 'votes')
        searchUrl.searchParams.append('reverse', 'true')
        url = searchUrl.toString()
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error('API Error')

      const data = await response.json()
      return (data as Station[]).filter(isPlayableStation)
    } catch (error) {
      console.error('Failed to fetch top stations:', error)
      return []
    }
  }
}
