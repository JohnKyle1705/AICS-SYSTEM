import React, { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
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
    AsyncStorage.getItem('aics_lang').then(saved => {
      if (saved === 'en') {
        setLanguageState(saved)
      }
    })
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    AsyncStorage.setItem('aics_lang', lang)
  }

  const t = (key: string): string => {
    const keys = key.split('.')
    let value: any = (translations as any)[language] || translations['en']
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

export const useLanguage = () => {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
