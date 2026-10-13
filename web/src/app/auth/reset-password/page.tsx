'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Loader2, CheckCircle2, Eye, EyeOff, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase parses the hash fragment from the reset email link and establishes a session
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/login'), 3000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-community bg-overlay p-6" id="reset-password-page">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-lg border border-slate-100 dark:border-slate-700">
              <Image src="/dswd_logo.png" alt="DSWD" width={40} height={40} className="object-contain" priority />
            </div>
            <div className="w-px h-10 bg-slate-300 dark:bg-slate-700" />
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-lg border border-slate-100 dark:border-slate-700">
              <Image src="/aics_logo.png" alt="AICS" width={40} height={40} className="object-contain" priority />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">AICS System</h1>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-200 dark:border-slate-800 p-8">

          {success ? (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="animate-[bounce_1s_ease-in-out_1]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Password Updated!</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Your password has been changed. Redirecting to login...</p>
              <div className="mt-6 flex justify-center">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            </div>
          ) : !sessionReady ? (
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400 text-sm">Validating reset link...</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-2">
                If this takes too long, the link may have expired.{' '}
                <Link href="/forgot-password" className="text-blue-600 hover:underline">Request a new one</Link>
              </p>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="mb-6">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                  <Lock size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Set New Password</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Enter your new password below</p>
              </div>

              <form onSubmit={handleReset} className="space-y-5" id="reset-password-form">
                <div>
                  <label className="form-label" htmlFor="new-password">New Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="form-input pl-10 pr-11"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1" tabIndex={-1}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="form-input pl-10"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 ml-1">Must be at least 6 characters</p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn btn-primary w-full py-3" id="reset-submit">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Updating Password...</> : <>Update Password <ArrowRight size={16} /></>}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
          <Link href="/login" className="text-blue-600 hover:underline">← Back to Sign In</Link>
        </p>
      </div>
    </div>
  )
}
