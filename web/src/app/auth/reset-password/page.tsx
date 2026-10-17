'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AuthChangeEvent } from '@supabase/supabase-js'
import { Lock, Loader2, CheckCircle2, Eye, EyeOff, ArrowRight, AlertTriangle } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {
  validatePassword,
  checkPasswordRequirements,
  calculatePasswordStrength,
} from '@/lib/passwordValidation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionTimedOut, setSessionTimedOut] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)

  useEffect(() => {
    let isMounted = true
    const supabase = createClient()

    // 1. Immediate check: session from SSR /auth/callback cookies
    supabase.auth.getSession().then((res: any) => {
      if (!isMounted) return
      const session = res.data?.session
      if (session) setSessionReady(true)
    })

    // 2. Listen for auth changes (covers hash fragment flow and async token exchanges)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: any) => {
        if (!isMounted) return
        if (
          event === 'PASSWORD_RECOVERY' ||
          (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION'))
        ) {
          setSessionReady(true)
        }
      }
    )

    // 3. Fallback timer: if no valid recovery session detected after 3 seconds
    const timer = setTimeout(async () => {
      if (!isMounted) return
      const res = await supabase.auth.getSession()
      if (res.data?.session) {
        setSessionReady(true)
      } else {
        setSessionTimedOut(true)
      }
    }, 3000)

    return () => {
      isMounted = false
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  // ── Password validation ────────────────────────────────────────────────────
  const requirements = useMemo(() => checkPasswordRequirements(newPassword), [newPassword])
  const strength = useMemo(() => calculatePasswordStrength(newPassword), [newPassword])
  const allMet = useMemo(() => requirements.every(r => r.met), [requirements])
  const firstUnmet = useMemo(() => requirements.find(r => !r.met) || null, [requirements])

  // 2-column layout matching reference image
  const col1 = useMemo(() => [
    requirements.find(r => r.id === 'length')!,
    requirements.find(r => r.id === 'lowercase')!,
    requirements.find(r => r.id === 'special')!,
  ], [requirements])

  const col2 = useMemo(() => [
    requirements.find(r => r.id === 'uppercase')!,
    requirements.find(r => r.id === 'number')!,
    requirements.find(r => r.id === 'no_spaces')!,
  ], [requirements])

  const confirmMatch = newPassword === confirmPassword
  const confirmMismatch = confirmTouched && confirmPassword.length > 0 && !confirmMatch
  const confirmMatched = confirmTouched && confirmPassword.length > 0 && confirmMatch

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()

    const pwValidation = validatePassword(newPassword)
    if (!pwValidation.isValid) {
      setError(`Password requirement not met: Still needed: ${pwValidation.firstUnmet?.label || '8+ characters'}`)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')
    const supabase = createClient()

    // Supabase Auth hashes the password securely with bcrypt — never stored plain text
    const { data, error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Record audit log for password reset
    try {
      if (data?.user) {
        await supabase.from('system_logs').insert({
          user_id: data.user.id,
          action: 'PASSWORD_RESET',
          table_name: 'auth',
          details: { event: 'Password reset completed via recovery link', email: data.user.email },
        })
      }
    } catch {
      // Don't block if logging fails
    }

    // Sign out to clear recovery session so user logs in cleanly with new password
    await supabase.auth.signOut()

    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/login?message=password_updated'), 2500)
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

          {/* ── SUCCESS ── */}
          {success ? (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="animate-[bounce_1s_ease-in-out_1]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Password Updated!</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Your password has been changed successfully. Redirecting you to sign in...
              </p>
              <div className="mt-6 flex justify-center">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            </div>

          ) : sessionTimedOut && !sessionReady ? (
            /* ── EXPIRED / INVALID LINK ── */
            <div className="text-center py-6 animate-fade-in">
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Reset Link Expired or Invalid
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                We could not establish a valid password recovery session. The reset link may have expired or was already used.
              </p>
              <Link
                href="/forgot-password"
                className="btn btn-primary inline-flex items-center gap-2 py-2.5 px-6"
              >
                Request New Reset Link
              </Link>
            </div>

          ) : !sessionReady ? (
            /* ── LOADING / VALIDATING ── */
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400 text-sm">Validating reset link...</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-2">
                If this takes too long, the link may have expired.{' '}
                <Link href="/forgot-password" className="text-blue-600 hover:underline">Request a new one</Link>
              </p>
            </div>

          ) : (
            /* ── RESET FORM ── */
            <div className="animate-fade-in">
              <div className="mb-6">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                  <Lock size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Set New Password</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Enter your new password below</p>
              </div>

              <form onSubmit={handleReset} className="space-y-4" id="reset-password-form">
                {/* ── New Password ── */}
                <div className="space-y-2.5">
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200" htmlFor="new-password">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-700 dark:text-emerald-400">
                      <Lock size={17} strokeWidth={2.2} />
                    </div>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 pl-11 pr-11 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      placeholder="Create a password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {newPassword.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-500 dark:text-slate-400">Password strength</span>
                        <span className={`font-bold transition-colors ${strength.colorClass}`}>{strength.label}</span>
                      </div>
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3, 4].map(idx => (
                          <div
                            key={idx}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                              idx < strength.score
                                ? strength.score === 1
                                  ? 'bg-red-500'
                                  : strength.score <= 3
                                  ? 'bg-amber-500'
                                  : strength.score === 4
                                  ? 'bg-blue-500'
                                  : 'bg-emerald-500'
                                : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Requirements grid */}
                  {newPassword.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2.5">Your password must include:</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {/* Column 1 */}
                        <div className="space-y-2">
                          {col1.map(req => (
                            <div key={req.id} className="flex items-center gap-2 text-xs">
                              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                                req.met
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-slate-400 dark:border-slate-500 bg-transparent'
                              }`}>
                                {req.met && (
                                  <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                                    <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </span>
                              <span className={`font-medium transition-colors ${req.met ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                {req.label}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Column 2 */}
                        <div className="space-y-2">
                          {col2.map(req => (
                            <div key={req.id} className="flex items-center gap-2 text-xs">
                              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                                req.met
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-slate-400 dark:border-slate-500 bg-transparent'
                              }`}>
                                {req.met && (
                                  <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                                    <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </span>
                              <span className={`font-medium transition-colors ${req.met ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                {req.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Validation message */}
                      <div className={`mt-2.5 text-xs font-bold transition-colors ${allMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {allMet
                          ? '✓ All password requirements met.'
                          : `Still needed: ${firstUnmet?.label || '8+ characters'}`}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Confirm Password ── */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5" htmlFor="confirm-password">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-700 dark:text-emerald-400">
                      <Lock size={17} strokeWidth={2.2} />
                    </div>
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setConfirmTouched(true) }}
                      onBlur={() => setConfirmTouched(true)}
                      required
                      className={`w-full rounded-2xl border bg-white dark:bg-slate-900/60 pl-11 pr-11 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden transition-all duration-200 ${
                        confirmMismatch
                          ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-400/20'
                          : confirmMatched
                          ? 'border-emerald-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmMismatch && (
                    <p className="text-xs font-semibold text-red-600 dark:text-red-500 mt-1.5 ml-1">Passwords do not match.</p>
                  )}
                  {confirmMatched && (
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5 ml-1">✓ Passwords match.</p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !allMet || !confirmMatch}
                  className="btn btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  id="reset-submit"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> Updating Password...</>
                  ) : (
                    <>Update Password <ArrowRight size={16} /></>
                  )}
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
