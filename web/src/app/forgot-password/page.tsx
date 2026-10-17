'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  KeyRound,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import {
  checkPasswordRequirements,
  calculatePasswordStrength,
  validatePassword,
} from '@/lib/passwordValidation'

function ForgotPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Steps: 'email' (enter email) -> 'code_and_password' (matching user reference) -> 'success'
  const [step, setStep] = useState<'email' | 'code_and_password' | 'success'>('email')

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)

  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  // Prefill email or error from query if available
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) setError(errorParam)

    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
      setStep('code_and_password')
    }
  }, [searchParams])

  // Cooldown timer for resend code
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

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

  // ── Step 1: Request Code ─────────────────────────────────────────────────
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)
    setError('')
    setFeedback('')

    const supabase = createClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${siteUrl}/auth/callback?type=recovery`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setStep('code_and_password')
    setResendCooldown(60)
    setLoading(false)
  }

  // ── Resend Code ──────────────────────────────────────────────────────────
  const handleResendCode = async () => {
    if (resendCooldown > 0 || resending) return
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) return

    setResending(true)
    setError('')
    setFeedback('')

    const supabase = createClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

    const { error: resendError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${siteUrl}/auth/callback?type=recovery`,
    })

    if (resendError) {
      setError(resendError.message)
    } else {
      setFeedback('A new 6-digit code has been sent to your email.')
      setResendCooldown(60)
    }
    setResending(false)
  }

  // ── Step 2: Verify Code and Reset Password ────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    const cleanCode = code.trim().replace(/\s+/g, '')

    if (!cleanCode) {
      setError('Please enter the 6-digit code sent to your email.')
      return
    }

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
    setFeedback('')

    const supabase = createClient()

    // 1. Verify 6-digit OTP code with Supabase Auth recovery type
    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: 'recovery',
    })

    if (otpError) {
      setError(otpError.message || 'Invalid or expired 6-digit code. Please request a new one.')
      setLoading(false)
      return
    }

    // 2. Update the user password securely
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // 3. Record audit log
    try {
      const user = otpData?.user || updateData?.user
      if (user) {
        await supabase.from('system_logs').insert({
          user_id: user.id,
          action: 'PASSWORD_RESET',
          table_name: 'auth',
          details: { event: 'Password reset completed via 6-digit OTP code', email: user.email },
        })
      }
    } catch {
      // Non-blocking audit log
    }

    // 4. Sign out recovery session so user can log in freshly
    await supabase.auth.signOut()

    setStep('success')
    setLoading(false)
    setTimeout(() => {
      router.push('/login?message=password_updated')
    }, 2500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-community bg-overlay p-4 sm:p-6" id="forgot-password-page">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-100 dark:border-slate-800 p-6 sm:p-8 relative">

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 1: ENTER EMAIL
             ═══════════════════════════════════════════════════════════════════ */}
          {step === 'email' && (
            <div className="animate-fade-in">
              {/* Back Button */}
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs mb-3"
                aria-label="Back to sign in"
              >
                <ArrowLeft size={18} />
              </Link>

              {/* Title & Accent */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-extrabold tracking-wide text-[#143d2b] dark:text-emerald-300">
                  FORGOT PASSWORD
                </h1>
                <div className="w-10 h-1 bg-[#40916c] rounded-full mx-auto mt-2" />
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-3">
                  Enter your email address to receive a 6-digit password reset code.
                </p>
              </div>

              <form onSubmit={handleRequestCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5" htmlFor="request-email">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1b4332] dark:text-emerald-400 pointer-events-none">
                      <Mail size={18} />
                    </div>
                    <input
                      id="request-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="name@example.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 pl-11 pr-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-[#40916c] focus:ring-2 focus:ring-[#40916c]/20 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-[#628b78] hover:bg-[#527967] text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-md shadow-[#628b78]/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    'Send Reset Code'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Remember your password?{' '}
                <Link href="/login" className="text-[#2d6a4f] dark:text-emerald-400 font-bold hover:underline">
                  Sign in
                </Link>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 2: REFERENCE MATCH (6-Digit Code + New Password + Confirm)
             ═══════════════════════════════════════════════════════════════════ */}
          {step === 'code_and_password' && (
            <div className="animate-fade-in">
              {/* Back button */}
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setError('')
                  setFeedback('')
                }}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs mb-3"
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>

              {/* Header Title with green accent line */}
              <div className="text-center mb-4">
                <h1 className="text-2xl font-extrabold tracking-wide text-[#143d2b] dark:text-emerald-300">
                  FORGOT PASSWORD
                </h1>
                <div className="w-10 h-1 bg-[#40916c] rounded-full mx-auto mt-2" />
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-2.5 leading-relaxed">
                  Enter the code sent to <span className="font-bold text-slate-900 dark:text-slate-100">{email}</span>, then create your new password.
                </p>
              </div>

              {/* Green info message banner matching reference */}
              <p className="text-[#2d6a4f] dark:text-emerald-400 text-xs sm:text-sm font-semibold mb-4 text-left">
                A 6-digit password reset code was sent to your email.
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4" id="forgot-password-reset-form">
                {/* ── 1. 6-Digit Code ── */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5" htmlFor="otp-code">
                    6-Digit Code
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1b4332] dark:text-emerald-400 pointer-events-none">
                      <KeyRound size={18} />
                    </div>
                    <input
                      id="otp-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                      placeholder="1 2 3 4 5 6"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 pl-11 pr-4 py-3 text-sm font-mono tracking-wider text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-[#40916c] focus:ring-2 focus:ring-[#40916c]/20 transition-all"
                    />
                  </div>
                </div>

                {/* ── 2. New Password ── */}
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

                {/* ── 3. Confirm New Password ── */}
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

                {/* Error / Success Feedback */}
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl">
                    {error}
                  </div>
                )}
                {feedback && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs px-3.5 py-2.5 rounded-xl">
                    {feedback}
                  </div>
                )}

                {/* ── Reset Password Button (Sage Green matching reference) ── */}
                <button
                  type="submit"
                  disabled={loading || !allMet || !confirmMatch || !code.trim()}
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

              {/* Resend Code Link */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || resending}
                  className="text-xs sm:text-sm font-bold text-[#2d6a4f] dark:text-emerald-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resending
                    ? 'Sending new code...'
                    : resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend code'}
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 3: SUCCESS STATE
             ═══════════════════════════════════════════════════════════════════ */}
          {step === 'success' && (
            <div className="animate-fade-in text-center py-6">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-[#2d6a4f] dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={36} className="animate-[bounce_1s_ease-in-out_1]" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
                Password Reset Successfully!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mb-6">
                Your new password is now active. Redirecting you to sign in...
              </p>
              <div className="flex justify-center">
                <Loader2 size={22} className="animate-spin text-[#40916c]" />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-community bg-overlay">
          <Loader2 className="w-8 h-8 animate-spin text-[#40916c]" />
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  )
}
