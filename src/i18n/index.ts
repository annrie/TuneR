import { createI18n } from 'vue-i18n'
import ja from './locales/ja.json'
import en from './locales/en.json'
import de from './locales/de.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ko from './locales/ko.json'
import ptBR from './locales/pt-BR.json'
import zhTW from './locales/zh-TW.json'

export type Locale = 'ja' | 'en' | 'de' | 'es' | 'fr' | 'ko' | 'pt-BR' | 'zh-TW'

export const availableLocales: { code: Locale; name: string }[] = [
  { code: 'ja', name: '日本語' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'ko', name: '한국어' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'zh-TW', name: '繁體中文' },
]

const storedLocale = (typeof localStorage !== 'undefined'
  ? localStorage.getItem('tuner-locale')
  : null) as Locale | null

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: storedLocale ?? 'ja',
  fallbackLocale: 'en',
  messages: {
    ja,
    en,
    de,
    es,
    fr,
    ko,
    'pt-BR': ptBR,
    'zh-TW': zhTW,
  },
})

export default i18n
