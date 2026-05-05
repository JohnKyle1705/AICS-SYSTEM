import React from 'react'
import { LogBox } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/lib/AuthContext'
import { ThemeProvider } from './src/lib/ThemeContext'
import { LanguageProvider } from './src/lib/LanguageContext'
import AppNavigator from './src/navigation/AppNavigator'

LogBox.ignoreLogs(['AuthApiError: Invalid Refresh Token'])

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  )
}
