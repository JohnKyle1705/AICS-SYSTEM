'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import translations, { Language, TranslationKey } from './i18n/translations'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const saved = localStorage.getItem('aics_lang') as Language | null
    if (saved === 'en' || saved === 'fil') {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('aics_lang', lang)
  }

  const t = (key: string): string => {
    const keys = key.split('.')
    let value: any = translations[language]
    for (const k of keys) {
      value = value?.[k]
    }
    if (value && typeof value === 'string') return value

    // Fallback to English
    value = translations['en']
    for (const k of keys) {
      value = value?.[k]
    }
    return (value && typeof value === 'string') ? value : key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
