import type { Station } from '../types'

const BASE_URL = 'https://de1.api.radio-browser.info/json'

// 再生不可コーデックの判定・バッジ表示は utils/codecSupport.ts に集約

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
        return await res.json() as Station[]
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
      return data as Station[]
    } catch (error) {
      console.error('Failed to fetch top stations:', error)
      return []
    }
  }
}
