'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

/**
 * AuthGuard listens for Supabase auth state changes on the client side.
 * If the session is lost due to a stale/invalid refresh token, it actively clears
 * broken auth cookies and storage, then redirects to /login — preventing the
 * "Invalid Refresh Token: Refresh Token Not Found" error loop.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createClient()

    const clearAuthCookiesAndStorage = () => {
      if (typeof document !== 'undefined') {
        document.cookie.split(';').forEach((cookie) => {
          const name = cookie.split('=')[0].trim()
          if (name.startsWith('sb-')) {
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
          }
        })
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        Object.keys(window.localStorage).forEach((key) => {
          if (key.startsWith('sb-')) {
            window.localStorage.removeItem(key)
          }
        })
      }
    }

    const handleAuthFailure = () => {
      clearAuthCookiesAndStorage()
      const pathname = window.location.pathname
      const isPublic =
        pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/auth')

      if (!isPublic && pathname !== '/') {
        window.location.href = '/login'
      }
    }

    // Proactively verify session on initial mount to catch stale refresh tokens immediately
    supabase.auth.getSession().then((res: { data: { session: Session | null }; error: any }) => {
      if (res.error && (res.error.message?.includes('Refresh Token') || res.error.status === 400)) {
        handleAuthFailure()
      }
    }).catch(() => {
      handleAuthFailure()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (
          event === 'SIGNED_OUT' ||
          (!session && (event as string) === 'TOKEN_REFRESH_FAILED')
        ) {
          handleAuthFailure()
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return <>{children}</>
}
