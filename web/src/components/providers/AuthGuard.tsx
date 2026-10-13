'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * AuthGuard listens for Supabase auth state changes on the client side.
 * If the session is lost due to a stale/invalid refresh token, it clears
 * the broken session and redirects to /login — preventing the
 * "Invalid Refresh Token: Refresh Token Not Found" error loop.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'TOKEN_REFRESHED') {
          // Token refreshed successfully — nothing to do
        }

        if (event === 'SIGNED_OUT') {
          // Session was cleared (possibly due to invalid refresh token)
          // The middleware will handle the redirect to /login
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return <>{children}</>
}
