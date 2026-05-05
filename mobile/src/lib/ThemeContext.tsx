import React, { createContext, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  isDark: boolean
  toggleTheme: () => void
  colors: typeof Colors.light
}

export const Colors = {
  light: {
    background: '#f8fafc',
    card: 'rgba(255, 255, 255, 0.95)',
    text: '#0f172a',
    textSecondary: '#475569',
    border: 'rgba(226, 232, 240, 0.8)',
    primary: '#2563eb',
    accent: '#eff6ff',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
  },
  dark: {
    background: '#020617', // Deeper slate background
    card: 'rgba(15, 23, 42, 0.85)', // Glassmorphism Slate 900
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    border: 'rgba(51, 65, 85, 0.7)',
    primary: '#3b82f6',
    accent: 'rgba(30, 41, 59, 0.8)',
    error: '#f87171',
    success: '#34d399',
    warning: '#fbbf24',
  }
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme()
  const [theme, setTheme] = useState<Theme>(systemColorScheme === 'dark' ? 'dark' : 'light')

  useEffect(() => {
    // Load persisted theme
    AsyncStorage.getItem('app_theme').then(savedTheme => {
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme)
      }
    })
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    AsyncStorage.setItem('app_theme', newTheme)
  }

  const value = {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    colors: Colors[theme]
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
