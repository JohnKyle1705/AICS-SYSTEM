'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, ShieldCheck, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

type Step = 'request' | 'success'

function ForgotPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('request')

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(errorParam)
    }
  }, [searchParams])

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    
    const supabase = createClient()

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`
    })

    if (resetError) {
      setError(resetError.message)
    } else {
      setInfo(`A password reset link has been sent to ${email}. Please check your inbox.`)
      setStep('success')
    }
    
    setLoading(false)
  }

  const maskEmail = (e: string) => {
    const [name, domain] = e.split('@')
    if (!domain) return e
    return `${name.charAt(0)}${'*'.repeat(Math.max(1, name.length - 1))}@${domain}`
  }

  return (
    <div className="min-h-screen flex bg-community bg-overlay" id="forgot-password-page">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl" />
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
            Reset your account password securely using your registered email address.
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

          <div className="bg-[var(--color-surface)] rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-200 dark:border-slate-800 p-8">

            {/* STEP 1 — REQUEST */}
            {step === 'request' && (
              <div className="animate-fade-in">
                <div className="mb-6">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                    <ShieldCheck size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reset Your Password</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Enter your email to receive a reset link</p>
                </div>

                <form onSubmit={handleRequest} className="space-y-5" id="forgot-password-form">
                  <div>
                    <label className="form-label" htmlFor="reset-email">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="form-input pl-10" placeholder="name@example.com" />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn btn-primary w-full py-3" id="forgot-submit">
                    {loading ? <><Loader2 size={18} className="animate-spin" /> Sending...</> : <>Send Reset Link <ArrowRight size={16} /></>}
                  </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                  Remember your password?{' '}
                  <Link href="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
                </div>
              </div>
            )}

            {/* SUCCESS STATE */}
            {step === 'success' && (
              <div className="animate-fade-in text-center py-8">
                <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={40} className="animate-[bounce_1s_ease-in-out_1]" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Check Your Email!
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs mx-auto">
                  {info}
                </p>
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300 text-left">
                  <p className="font-semibold mb-1">📧 Next steps:</p>
                  <p>Open the reset link in the email, then set your new password.</p>
                </div>
                
                <Link href="/login" className="inline-block mt-6 text-blue-600 font-semibold text-sm hover:underline">
                  Back to Sign In →
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-community bg-overlay">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  )
}
