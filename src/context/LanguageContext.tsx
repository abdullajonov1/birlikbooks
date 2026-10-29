import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { dictionary } from '../i18n'
import { LANGS } from '../types'
import type { Lang } from '../types'

type LanguageValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (typeof dictionary)['uz']
}

const LanguageContext = createContext<LanguageValue | null>(null)
const storageKey = 'birlik-lang'

function readLang(): Lang {
  const saved = localStorage.getItem(storageKey)
  return LANGS.includes(saved as Lang) ? (saved as Lang) : 'uz'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)

  useEffect(() => {
    document.documentElement.lang = lang === 'uz-cyrl' ? 'uz' : lang
    document.title =
      lang === 'en' ? 'Birlik bookstore' : lang === 'ru' ? 'Birlik — книжный магазин' : lang === 'uz-cyrl' ? 'Бирлик — китоблар дўкони' : "Birlik — kitoblar do'koni"
    localStorage.setItem(storageKey, lang)
  }, [lang])

  const value = useMemo(
    () => ({
      lang,
      setLang: setLangState,
      t: dictionary[lang],
    }),
    [lang],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('language')
  return value
}
