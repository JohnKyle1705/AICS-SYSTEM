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
        // keepalive survives navigation; sendBeacon is the ultimate fallback
        try {
          const sent = navigator.sendBeacon?.('/api/auth/signout')
          if (!sent) fetch('/api/auth/signout', { method: 'POST', keepalive: true }).catch(() => {})
        } catch { /* ignore */ }
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

    const handleAuthFailure = () => {
      // Purge client-side state immediately
      clearAllSupabaseAuth()

      const pathname = window.location.pathname
      const isPublic =
        pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/pending')

      // Only redirect if we're actually on a protected page.
      // If already on /login (e.g. we just navigated there), do nothing.
      if (!isPublic && pathname !== '/') {
        // Fire cleanup fire-and-forget AFTER navigating
        window.location.replace('/login?logout=true')
        supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        try {
          navigator.sendBeacon?.('/api/auth/signout') ||
            fetch('/api/auth/signout', { method: 'POST', keepalive: true }).catch(() => {})
        } catch { /* ignore */ }
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
        // SIGNED_OUT fires during our own intentional logout too.
        // Only act on it for TOKEN_REFRESH_FAILED (unexpected session loss).
        // Our Sidebar.tsx handleLogout already navigates — no need to redirect again.
        if (!session && (event as string) === 'TOKEN_REFRESH_FAILED') {
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

