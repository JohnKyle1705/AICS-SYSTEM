'use client'

import { createClient, clearAllSupabaseAuth } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ShieldAlert, LogOut, RefreshCw, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

export default function PendingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(false)
  const [stillPending, setStillPending] = useState(false)

  const handleSignOut = async () => {
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
    window.location.href = '/login?logout=true'
  }

  const handleCheckStatus = async () => {
    setChecking(true)
    setStillPending(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        clearAllSupabaseAuth()
        window.location.href = '/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', session.user.id)
        .single()

      if (profile?.is_active) {
        // Account activated — redirect to dashboard router which will send to the right place
        router.push('/dashboard')
      } else {
        // Still pending — show warning
        setStillPending(true)
      }
    } catch {
      setStillPending(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-transparent">
      <div className="w-full max-w-md bg-[var(--color-surface)] rounded-2xl shadow-xl shadow-slate-200/20 dark:shadow-black/40 border border-slate-200 dark:border-slate-800 p-8 text-center animate-fade-in">
        
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>
        
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Account Pending Approval</h1>
        
        <p className="text-[var(--color-text-secondary)] mb-6 leading-relaxed">
          Your account has been successfully created, but it requires administrator approval before you can access the system. 
          Please contact your system administrator to activate your account.
        </p>

        {stillPending && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl px-4 py-3 mb-5 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
              Your account is still awaiting administrator approval. Please try again later.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="btn btn-primary w-full py-3 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking...' : 'Check Status Again'}
          </button>
          
          <button onClick={handleSignOut} className="btn btn-secondary w-full py-3 text-slate-600">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
        
      </div>
    </div>
  )
}
