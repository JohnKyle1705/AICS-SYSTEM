'use client'

import { useEffect } from 'react'
import { createClient, clearAllSupabaseAuth } from '@/lib/supabase/client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

/**
 * AuthGuard listens for Supabase auth state changes on the client side.
 * If the session is lost due to a stale/invalid refresh token, it actively clears
 * broken auth cookies and storage, then redirects to /login — preventing the
 * "Invalid Refresh Token: Refresh Token Not Found" error loop.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Intercept console.error for stale refresh token errors so they don't crash
    // or pop up as development error overlays during routine session expiry / cleanup.
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      const msg = args
        .map((a) => (typeof a === 'string' ? a : a?.message || a?.toString?.() || ''))
        .join(' ')
      if (
        msg.includes('Invalid Refresh Token') ||
        msg.includes('Refresh Token Not Found') ||
        msg.includes('refresh_token_not_found')
      ) {
        // Clean up stale session automatically without triggering dev overlay
        clearAllSupabaseAuth()
        fetch('/api/auth/signout', { method: 'POST' }).catch(() => {})
        const pathname = window.location.pathname
        const isPublic =
          pathname.startsWith('/login') ||
          pathname.startsWith('/register') ||
          pathname.startsWith('/forgot-password') ||
          pathname.startsWith('/auth')
        if (!isPublic && pathname !== '/') {
          window.location.href = '/login?logout=true'
        }
        return
      }
      originalConsoleError.apply(console, args)
    }

    const supabase = createClient()

    const handleAuthFailure = async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // ignore
      }
      clearAllSupabaseAuth()
      try {
        await fetch('/api/auth/signout', { method: 'POST' })
      } catch {
        // ignore
      }
      const pathname = window.location.pathname
      const isPublic =
        pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/auth')

      if (!isPublic && pathname !== '/') {
        window.location.href = '/login?logout=true'
      }
    }

    // Proactively verify session on initial mount to catch stale refresh tokens immediately
    supabase.auth.getSession().then((res: { data: { session: Session | null }; error: any }) => {
      if (
        res.error &&
        (res.error.message?.includes('Refresh Token') ||
          res.error.message?.includes('refresh_token_not_found') ||
          res.error.status === 400)
      ) {
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
      console.error = originalConsoleError
      subscription.unsubscribe()
    }
  }, [])

  return <>{children}</>
}

