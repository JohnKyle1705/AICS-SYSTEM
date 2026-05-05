'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { useLanguage } from '@/lib/LanguageContext'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedEmails, setSavedEmails] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    const stored = localStorage.getItem('aics_saved_emails')
    if (stored) {
      try {
        setSavedEmails(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse saved emails', e)
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      const newSaved = [email, ...savedEmails.filter(e => e !== email)].slice(0, 5)
      localStorage.setItem('aics_saved_emails', JSON.stringify(newSaved))
      setSavedEmails(newSaved)
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex bg-community bg-overlay" id="login-page">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl" />

        <div className="relative z-10 text-center px-12 animate-fade-in">
          <div className="flex items-center justify-center gap-8 mb-10">
            <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <Image src="/dswd_logo.png" alt="DSWD Logo" width={100} height={100} className="object-contain drop-shadow-xl hover:scale-105 transition-transform" priority />
            </div>
            <div className="w-px h-16 bg-slate-300 dark:bg-white/20" />
            <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Image src="/aics_logo.png" alt="AICS Logo" width={100} height={100} className="object-contain drop-shadow-xl hover:scale-105 transition-transform" priority />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
            AICS System
          </h1>
          <p className="text-slate-700 dark:text-blue-100/90 font-medium text-lg mb-2">
            {t('login_tagline')}
          </p>
          <div className="w-16 h-0.5 bg-slate-300 dark:bg-white/30 mx-auto my-6" />
          <p className="text-slate-600 dark:text-blue-200 font-medium text-sm max-w-sm mx-auto leading-relaxed">
            {t('login_municipality')}<br />
            {t('login_office')}
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-6 mb-6">
              <Image src="/dswd_logo.png" alt="DSWD" width={60} height={60} className="object-contain drop-shadow-lg" priority />
              <div className="w-px h-8 bg-slate-300 dark:bg-white/20" />
              <Image src="/aics_logo.png" alt="AICS" width={60} height={60} className="object-contain drop-shadow-lg" priority />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">AICS System</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Daanbantayan MSWD</p>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-200 dark:border-slate-800 p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text)]">{t('login_welcomeBack')}</h2>
              <p className="text-[var(--color-text-secondary)] text-sm mt-1">{t('login_signInToContinue')}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5" id="login-form">
              <div>
                <label className="form-label" htmlFor="login-email">{t('login_emailAddress')}</label>
                <div className="relative">
                  {!email && <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-opacity" />}
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    required
                    autoComplete="off"
                    className={`form-input transition-all ${email ? 'pl-4' : 'pl-10'}`}
                  />
                  {showSuggestions && savedEmails.length > 0 && (
                    <ul className="absolute z-50 w-full mt-1 bg-[var(--color-surface)] border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {savedEmails.map((savedEmail, idx) => (
                        <li
                          key={idx}
                          className="px-4 py-2 text-sm text-[var(--color-text)] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setEmail(savedEmail)
                            setShowSuggestions(false)
                          }}
                        >
                          {savedEmail}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="login-password">{t('login_password')}</label>
                <div className="relative">
                  {!password && <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-opacity" />}
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="off"
                    className={`form-input transition-all pr-11 ${password ? 'pl-4' : 'pl-10'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded"
                    tabIndex={-1}
                    aria-label={showPassword ? t('login_hidePassword') : t('login_showPassword')}
                    id="toggle-password-visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3"
                id="login-submit"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t('login_signingIn')}
                  </>
                ) : (
                  <>
                    {t('login_signIn')}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              {t('login_noAccount')}{' '}
              <Link href="/register" className="text-blue-600 font-semibold hover:underline">
                {t('login_signUpHere')}
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
            {t('login_authorizedOnly')}
          </p>
        </div>
      </div>
    </div>
  )
}
