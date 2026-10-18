import React, { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import type { Session } from '@supabase/supabase-js'

interface AuthContextType {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<Profile | null>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => null,
})

/** Clears stale Supabase tokens from AsyncStorage so they don't cause
 *  "Invalid Refresh Token" errors on the next app launch. */
const clearStaleSession = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const supabaseKeys = keys.filter(k => k.startsWith('sb-'))
    if (supabaseKeys.length > 0) await AsyncStorage.multiRemove(supabaseKeys)
  } catch (e) {
    console.warn('Failed to clear stale session keys:', e)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.warn('Session retrieval error:', error.message)
        await clearStaleSession()
        await Promise.race([
          supabase.auth.signOut({ scope: 'local' }),
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ]).catch(() => {})
        setProfile(null)
        setSession(null)
        setLoading(false)
        return
      }
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setLoading(false)
    }).catch(async (e) => {
      console.warn('getSession rejected:', e)
      await clearStaleSession()
      setProfile(null)
      setSession(null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event as string) === 'TOKEN_REFRESH_FAILED') {
        console.warn('Token refresh failed. Signing out.')
        await clearStaleSession()
        await Promise.race([
          supabase.auth.signOut({ scope: 'local' }),
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ]).catch(() => {})
        setProfile(null)
        setSession(null)
        setLoading(false)
        return
      }
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data || null)
    } catch (e) {
      console.warn('Failed to load profile:', e)
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = async () => {
    try {
      const currentSession = session || (await supabase.auth.getSession()).data.session
      if (!currentSession?.user) return null
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single()
      if (data) {
        setProfile(data)
      }
      return data || null
    } catch {
      return null
    }
  }

  const signOut = async () => {
    try {
      // 1. Immediately reset state so navigation jumps to Login instantly
      setProfile(null)
      setSession(null)
      setLoading(false)

      // 2. Best-effort Supabase client signout (local scope, 800ms timeout)
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]).catch(() => {})

      // 3. Purge any lingering sb- keys from AsyncStorage
      await clearStaleSession().catch(() => {})
    } catch (err) {
      console.warn('Mobile signOut error:', err)
    } finally {
      setProfile(null)
      setSession(null)
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
