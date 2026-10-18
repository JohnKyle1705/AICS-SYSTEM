import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AICS System — Daanbantayan MSWD',
  description: 'Assistance to Individuals in Crisis Situation — Request Management & Beneficiary Information System',
  keywords: ['AICS', 'MSWD', 'Daanbantayan', 'social welfare', 'assistance'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { LanguageProvider } from '@/lib/LanguageContext'
import { AuthGuard } from '@/components/providers/AuthGuard'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className}>
        <LanguageProvider>
          <ThemeProvider>
            <AuthGuard>{children}</AuthGuard>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}

