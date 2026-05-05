'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react'

export default function PendingPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleRefresh = () => {
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-transparent">
      <div className="w-full max-w-md bg-[var(--color-surface)] rounded-2xl shadow-xl shadow-slate-200/20 dark:shadow-black/40 border border-slate-200 dark:border-slate-800 p-8 text-center animate-fade-in">
        
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>
        
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Account Pending Approval</h1>
        
        <p className="text-[var(--color-text-secondary)] mb-8 leading-relaxed">
          Your account has been successfully created, but it requires administrator approval before you can access the system. 
          Please contact your system administrator to activate your account.
        </p>

        <div className="space-y-3">
          <button onClick={handleRefresh} className="btn btn-primary w-full py-3">
            <RefreshCw size={18} /> Check Status Again
          </button>
          
          <button onClick={handleSignOut} className="btn btn-secondary w-full py-3 text-slate-600">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
        
      </div>
    </div>
  )
}
