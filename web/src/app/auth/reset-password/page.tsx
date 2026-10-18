'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient, clearAllSupabaseAuth } from '@/lib/supabase/client'
import type { AuthChangeEvent } from '@supabase/supabase-js'
import {
  Lock,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import {
  validatePassword,
  checkPasswordRequirements,
  calculatePasswordStrength,
} from '@/lib/passwordValidation'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

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

  // ── Password Validation ───────────────────────────────────────────────────
  const requirements = useMemo(() => checkPasswordRequirements(newPassword), [newPassword])
  const strength = useMemo(() => calculatePasswordStrength(newPassword), [newPassword])
  const allMet = useMemo(() => requirements.every((r) => r.met), [requirements])
  const firstUnmet = useMemo(() => requirements.find((r) => !r.met) || null, [requirements])

  // 2-column layout matching reference image
  const col1 = useMemo(
    () => [
      requirements.find((r) => r.id === 'length')!,
      requirements.find((r) => r.id === 'lowercase')!,
      requirements.find((r) => r.id === 'special')!,
    ],
    [requirements]
  )

  const col2 = useMemo(
    () => [
      requirements.find((r) => r.id === 'uppercase')!,
      requirements.find((r) => r.id === 'number')!,
      requirements.find((r) => r.id === 'no_spaces')!,
    ],
    [requirements]
  )

  const confirmMatch = newPassword.length > 0 && newPassword === confirmPassword
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

    const { data, error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Audit log
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
      // Non-blocking
    }

    try {
      clearAllSupabaseAuth()
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ])
      // keepalive survives navigation; sendBeacon is the ultimate fallback
      const sent = navigator.sendBeacon?.('/api/auth/signout')
      if (!sent) fetch('/api/auth/signout', { method: 'POST', keepalive: true }).catch(() => {})
    } catch {
      // Non-blocking
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/login?message=password_updated'), 2500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-community bg-overlay p-4 sm:p-6" id="reset-password-page">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-100 dark:border-slate-800 p-6 sm:p-8">

          {/* ── SUCCESS ── */}
          {success ? (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-[#2d6a4f] dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={36} className="animate-[bounce_1s_ease-in-out_1]" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">Password Updated!</h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                Your password has been changed successfully. Redirecting you to sign in...
              </p>
              <div className="mt-5 flex justify-center">
                <Loader2 size={22} className="animate-spin text-[#40916c]" />
              </div>
            </div>

          ) : sessionTimedOut && !sessionReady ? (
            /* ── EXPIRED / INVALID LINK ── */
            <div className="text-center py-6 animate-fade-in">
              <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={28} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                Reset Link Expired or Invalid
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mb-5 leading-relaxed">
                We could not establish a valid password recovery session. You can request a 6-digit code or a new link.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block bg-[#6b9080] hover:bg-[#597d6d] text-white font-bold py-2.5 px-6 rounded-xl text-xs sm:text-sm shadow-md transition-all"
              >
                Go to Forgot Password
              </Link>
            </div>

          ) : !sessionReady ? (
            /* ── LOADING / VALIDATING ── */
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin text-[#40916c] mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400 text-sm">Validating recovery session...</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-2">
                Taking too long?{' '}
                <Link href="/forgot-password" className="text-[#2d6a4f] dark:text-emerald-400 font-bold hover:underline">
                  Request a new code
                </Link>
              </p>
            </div>

          ) : (
            /* ── RESET FORM MATCHING REFERENCE ── */
            <div className="animate-fade-in">
              {/* Back Button */}
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs mb-3"
                aria-label="Back to login"
              >
                <ArrowLeft size={18} />
              </Link>

              {/* Title & Accent */}
              <div className="text-center mb-4">
                <h1 className="text-2xl font-extrabold tracking-wide text-[#143d2b] dark:text-emerald-300">
                  FORGOT PASSWORD
                </h1>
                <div className="w-10 h-1 bg-[#40916c] rounded-full mx-auto mt-2" />
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-2.5">
                  Your recovery link has been verified. Create your new password below.
                </p>
              </div>

              <form onSubmit={handleReset} className="space-y-4" id="reset-password-form">
                {/* ── New Password ── */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200" htmlFor="new-password">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1b4332] dark:text-emerald-400 pointer-events-none">
                      <Lock size={18} />
                    </div>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Create a new password"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 pl-11 pr-11 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-[#40916c] focus:ring-2 focus:ring-[#40916c]/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password Strength Meter (5 bars) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-300">Password strength</span>
                      <span className={newPassword.length === 0 ? 'text-[#143d2b] dark:text-slate-400 font-extrabold' : strength.colorClass}>
                        {newPassword.length === 0 ? 'Not set' : strength.label}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {[0, 1, 2, 3, 4].map((idx) => (
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

                  {/* Requirements List (2-column grid with circular indicators) */}
                  <div className="pt-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                      Your password must include:
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {/* Left Column */}
                      <div className="space-y-1.5">
                        {col1.map((req) => (
                          <div key={req.id} className="flex items-center gap-2">
                            <span
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                req.met
                                  ? 'bg-[#2d6a4f] text-white border border-[#2d6a4f]'
                                  : 'border border-slate-400 dark:border-slate-500 bg-transparent'
                              }`}
                            >
                              {req.met && (
                                <svg viewBox="0 0 10 8" fill="none" className="w-2 h-2">
                                  <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <span className={`text-xs transition-colors ${req.met ? 'text-[#2d6a4f] dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Right Column */}
                      <div className="space-y-1.5">
                        {col2.map((req) => (
                          <div key={req.id} className="flex items-center gap-2">
                            <span
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                req.met
                                  ? 'bg-[#2d6a4f] text-white border border-[#2d6a4f]'
                                  : 'border border-slate-400 dark:border-slate-500 bg-transparent'
                              }`}
                            >
                              {req.met && (
                                <svg viewBox="0 0 10 8" fill="none" className="w-2 h-2">
                                  <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <span className={`text-xs transition-colors ${req.met ? 'text-[#2d6a4f] dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* "Still needed:" status line */}
                    <div className="mt-2 text-xs font-semibold">
                      {allMet ? (
                        <span className="text-[#2d6a4f] dark:text-emerald-400">✓ All requirements met</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">
                          Still needed: {firstUnmet?.label || '8+ characters'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Confirm New Password ── */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5" htmlFor="confirm-password">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1b4332] dark:text-emerald-400 pointer-events-none">
                      <Lock size={18} />
                    </div>
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        setConfirmTouched(true)
                      }}
                      onBlur={() => setConfirmTouched(true)}
                      required
                      placeholder="Confirm your new password"
                      autoComplete="new-password"
                      className={`w-full rounded-xl border bg-white dark:bg-slate-800/80 pl-11 pr-11 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden transition-all ${
                        confirmMismatch
                          ? 'border-red-400 dark:border-red-500 focus:ring-2 focus:ring-red-400/20'
                          : confirmMatched
                          ? 'border-[#2d6a4f] dark:border-emerald-500 focus:ring-2 focus:ring-[#2d6a4f]/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-[#40916c] focus:ring-2 focus:ring-[#40916c]/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmMismatch && (
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1.5">
                      Passwords do not match.
                    </p>
                  )}
                  {confirmMatched && (
                    <p className="text-xs font-semibold text-[#2d6a4f] dark:text-emerald-400 mt-1.5">
                      ✓ Passwords match.
                    </p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl">
                    {error}
                  </div>
                )}

                {/* ── Reset Password Button (Sage Green matching reference) ── */}
                <button
                  type="submit"
                  disabled={loading || !allMet || !confirmMatch}
                  className="w-full bg-[#6b9080] hover:bg-[#597d6d] text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-md shadow-[#6b9080]/30 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  id="reset-submit-button"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Resetting Password...
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      Reset Password
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-community bg-overlay">
          <Loader2 className="w-8 h-8 animate-spin text-[#40916c]" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
