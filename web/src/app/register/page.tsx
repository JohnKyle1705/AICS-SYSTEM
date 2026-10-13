'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, User, ArrowRight, Loader2, KeyRound, CheckCircle2, RefreshCw, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'

type Step = 'register' | 'verify' | 'success'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('register')

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Verification State
  const [otp, setOtp] = useState('')
  const [cooldown, setCooldown] = useState(0)

  // UI State
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }
    if (!termsAccepted) {
      setError('You must agree to the Terms and Conditions.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const fullName = `${firstName.trim()} ${lastName.trim()}`

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (authData.user && !authData.session) {
      // Email confirmation required — OTP sent
      setStep('verify')
      setCooldown(60)
      setLoading(false)
    } else if (authData.user && authData.session) {
      // Email confirmation disabled — create profile immediately
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        full_name: fullName,
        role: 'resident',
        is_active: false
      }, { onConflict: 'id', ignoreDuplicates: true })
      setStep('success')
      setLoading(false)
      setTimeout(() => { router.push('/pending'); router.refresh() }, 2000)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length < 6) {
      setError('Please enter a valid 6-digit code.')
      return
    }

    setLoading(true)
    setError('')
    const supabase = createClient()
    const fullName = `${firstName.trim()} ${lastName.trim()}`

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup'
    })

    if (verifyError) { setError(verifyError.message); setLoading(false); return }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        role: 'resident',
        is_active: false
      }, { onConflict: 'id', ignoreDuplicates: true })
      setStep('success')
      setLoading(false)
      setTimeout(() => { router.push('/pending'); router.refresh() }, 2000)
    }
  }

  const handleResendCode = async () => {
    if (cooldown > 0) return
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
    if (resendError) setError(resendError.message)
    else setCooldown(60)
    
    setLoading(false)
  }

  const maskEmail = (emailStr: string) => {
    if (!emailStr) return ''
    const [name, domain] = emailStr.split('@')
    if (!domain) return emailStr
    return `${name.charAt(0)}${'*'.repeat(Math.max(1, name.length - 1))}@${domain}`
  }

  return (
    <div className="min-h-screen flex bg-community bg-overlay" id="register-page">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl" />

        <div className="relative z-10 text-center px-12 animate-fade-in">
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="bg-white/40 dark:bg-white/10 backdrop-blur-md rounded-2xl p-4 hover:scale-105 transition-transform duration-300 shadow-2xl border border-white/40 dark:border-white/20">
              <Image src="/dswd_logo.png" alt="DSWD Logo" width={72} height={72} className="object-contain drop-shadow-lg" priority />
            </div>
            <div className="w-1 h-20 bg-linear-to-b from-transparent via-slate-300 dark:via-white/40 to-transparent" />
            <div className="bg-white/40 dark:bg-white/10 backdrop-blur-md rounded-2xl p-4 hover:scale-105 transition-transform duration-300 shadow-2xl border border-white/40 dark:border-white/20">
              <Image src="/aics_logo.png" alt="AICS Logo" width={72} height={72} className="object-contain drop-shadow-lg" priority />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">AICS System</h1>
          <p className="text-slate-700 dark:text-blue-100/90 font-medium text-lg mb-2">Assistance to Individuals in Crisis Situation</p>
          <div className="w-16 h-0.5 bg-slate-300 dark:bg-white/30 mx-auto my-6" />
          <p className="text-slate-600 dark:text-blue-200 font-medium text-sm max-w-sm mx-auto leading-relaxed">
            Create an account to encode requests and manage beneficiary information.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-6">
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

          <div className="bg-[var(--color-surface)] rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-200 dark:border-slate-800 p-8 relative overflow-hidden">

            {/* STEP 1: REGISTRATION */}
            {step === 'register' && (
              <div className="animate-fade-in">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create an Account</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Join the AICS Management System</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-5" id="register-form">
                  {/* Name */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label" htmlFor="register-firstname">First Name</label>
                      <div className="relative">
                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input id="register-firstname" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="form-input pl-10" placeholder="Juan" autoComplete="given-name" />
                      </div>
                    </div>
                    <div>
                      <label className="form-label" htmlFor="register-lastname">Last Name</label>
                      <div className="relative">
                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input id="register-lastname" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="form-input pl-10" placeholder="Dela Cruz" autoComplete="family-name" />
                      </div>
                    </div>
                  </div>

                  {/* Email field */}
                  <div>
                    <label className="form-label" htmlFor="register-email">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="form-input pl-10" placeholder="name@example.com" autoComplete="off" />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="form-label" htmlFor="register-password">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input id="register-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="form-input pl-10 pr-11" placeholder="••••••••" autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded" tabIndex={-1}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input id="confirm-password" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="form-input pl-10" placeholder="••••••••" autoComplete="new-password" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 ml-1">Must be at least 6 characters long</p>
                  </div>

                  {/* Terms */}
                  <div className="flex items-start gap-3 mt-4">
                    <div className="flex items-center h-5 mt-0.5">
                      <input id="terms" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white/5 cursor-pointer" />
                    </div>
                    <label htmlFor="terms" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                      I have read and agree to the{' '}
                      <span className="text-blue-600 font-medium">Terms and Conditions</span> and{' '}
                      <span className="text-blue-600 font-medium">Privacy Policy</span> of the AICS Request Management System.
                    </label>
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn btn-primary w-full py-3 mt-2" id="register-submit">
                    {loading ? (
                      <><Loader2 size={18} className="animate-spin" /> Creating Account...</>
                    ) : (
                      <>Sign Up <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                  Already have an account?{' '}
                  <Link href="/login" className="text-blue-600 font-semibold hover:underline">Sign in here</Link>
                </div>
              </div>
            )}

            {/* STEP 2: VERIFY OTP */}
            {step === 'verify' && (
              <div className="animate-fade-in text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-blue-50 dark:bg-blue-900/20 text-blue-600`}>
                  <Mail size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Verify Your Email
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                  We&apos;ve sent a 6-digit verification code to<br/><span className="font-semibold text-slate-800 dark:text-slate-200">{maskEmail(email)}</span>
                </p>

                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div>
                    <label className="form-label text-left" htmlFor="otp-code">Verification Code</label>
                    <div className="relative">
                      <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="otp-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                        required
                        className="form-input pl-10 text-center tracking-widest text-lg font-mono font-bold"
                        placeholder="000000"
                        autoComplete="one-time-code"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg text-left">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading || otp.length < 6} className="btn btn-primary w-full py-3" id="verify-otp-submit">
                    {loading ? <><Loader2 size={18} className="animate-spin" /> Verifying...</> : 'Verify & Continue'}
                  </button>
                </form>

                <div className="mt-6 flex flex-col items-center gap-2 text-sm text-slate-500">
                  <p>Didn&apos;t receive the code?</p>
                  <button
                    onClick={handleResendCode}
                    disabled={cooldown > 0 || loading}
                    className={`flex items-center gap-1.5 font-semibold transition-colors ${cooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700 hover:underline'}`}
                    id="resend-code-btn"
                  >
                    <RefreshCw size={14} className={loading && cooldown === 0 ? 'animate-spin' : ''} />
                    {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend Code'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS */}
            {step === 'success' && (
              <div className="animate-fade-in text-center py-8">
                <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={40} className="animate-[bounce_1s_ease-in-out_1]" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Verified!</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Your email has been successfully verified. Redirecting you...
                </p>
                <div className="mt-8 flex justify-center">
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
              </div>
            )}

          </div>

          {step === 'register' && (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
              Registration is for authorized personnel. New accounts require Admin review.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
