'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient, clearAllSupabaseAuth } from '@/lib/supabase/client'
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2, X, Shield, FileText, ScrollText } from 'lucide-react'
import Image from 'next/image'
import { useLanguage } from '@/lib/LanguageContext'

// Bump this version whenever Terms & Conditions are updated.
// Users who accepted an older version will be asked to re-accept.
const TERMS_VERSION = '1.0.0'
const TERMS_ACCEPTED_KEY = 'aics_terms_accepted'

function getTermsAccepted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(TERMS_ACCEPTED_KEY)
    if (!stored) return false
    const parsed = JSON.parse(stored)
    return parsed.version === TERMS_VERSION && parsed.accepted === true
  } catch {
    return false
  }
}

function setTermsAccepted() {
  localStorage.setItem(
    TERMS_ACCEPTED_KEY,
    JSON.stringify({ version: TERMS_VERSION, accepted: true, acceptedAt: new Date().toISOString() })
  )
}

// ── Terms & Conditions Content ──────────────────────────────
const TERMS_SECTIONS = [
  {
    title: 'Purpose of the System',
    icon: '🎯',
    content:
      'This system is intended for the submission, processing, monitoring, and management of AICS (Assistance to Individuals in Crisis Situation) assistance requests under the Department of Social Welfare and Development (DSWD) — Municipality of Daanbantayan, MSWD.',
  },
  {
    title: 'User Responsibility',
    icon: '👤',
    content:
      'Users must provide accurate and truthful information when using this system. Users are also responsible for maintaining the confidentiality of their account credentials. Any activity that occurs under your account is your responsibility.',
  },
  {
    title: 'Privacy and Data Protection',
    icon: '🔒',
    content:
      'All personal information collected through the system shall be handled in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and applicable government regulations. Your data will only be used for the purpose of processing and managing AICS assistance requests.',
  },
  {
    title: 'Document Authenticity',
    icon: '📄',
    content:
      'Users must submit only valid and authentic documents. Submission of false, misleading, or fraudulent information may result in request rejection, account suspension, or legal action under applicable Philippine laws.',
  },
  {
    title: 'Assistance Approval',
    icon: '✅',
    content:
      'Submission of a request does not guarantee approval. All requests are subject to verification, assessment, and availability of government resources. The MSWD office reserves the right to approve, deny, or defer any request based on established criteria and guidelines.',
  },
  {
    title: 'Proper Use of the System',
    icon: '⚖️',
    content:
      'Users shall not attempt to misuse, manipulate, hack, or gain unauthorized access to any part of the system. Any violation of this provision may result in immediate account termination and referral to the appropriate authorities for legal action.',
  },
]

// ── Terms Modal Component ───────────────────────────────────
function TermsModal({ isOpen, onClose, onAccept }: { isOpen: boolean; onClose: () => void; onAccept?: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      id="terms-modal-overlay"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeInBackdrop" />

        {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-3xl shadow-2xl animate-modalSlideUp overflow-hidden"
        id="terms-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Terms and Conditions</h2>
              <p className="text-xs text-slate-500">AICS Request Management System — v{TERMS_VERSION}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all duration-200"
            aria-label="Close terms modal"
            id="close-terms-modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 custom-scrollbar">
          {/* Preamble */}
          <div className="mb-6 p-4 bg-cyan-50 border border-cyan-200/60 rounded-xl">
            <p className="text-sm text-cyan-950 leading-relaxed">
              By accessing and using the <strong className="text-cyan-800">AICS Request Management and Beneficiary Information System</strong>, you acknowledge that you have read, understood, and agree to be bound by the following terms and conditions.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-5">
            {TERMS_SECTIONS.map((section, idx) => (
              <div
                key={idx}
                className="group p-5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-2xl transition-all duration-300"
              >
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-xl shrink-0 mt-0.5">{section.icon}</span>
                  <h3 className="text-base font-bold text-slate-800 group-hover:text-slate-900 transition-colors">
                    {idx + 1}. {section.title}
                  </h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed pl-9">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {/* Footer Notice */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200/60 rounded-xl">
            <p className="text-xs text-amber-900/90 leading-relaxed">
              <strong className="text-amber-800">Note:</strong> These terms may be updated from time to time. Continued use of the system after changes constitutes acceptance of the revised terms. You will be prompted to re-accept when terms are updated.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 sm:px-8 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
          <button
            onClick={() => {
              if (onAccept) onAccept()
              else onClose()
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:scale-[1.01] active:scale-95"
            id="terms-understood-btn"
          >
            <CheckCircle2 size={18} />
            I Understand
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Login Page ─────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedEmails, setSavedEmails] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'admin' | 'resident' | null>(null)
  const { t } = useLanguage()

  // Terms & Conditions state
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('aics_saved_emails')
    if (stored) {
      try {
        setSavedEmails(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse saved emails', e)
      }
    }
    // Check if terms were previously accepted
    setTermsAccepted(getTermsAccepted())

    // Check URL parameters for messages/errors (e.g. from password reset)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('logout')) {
        clearAllSupabaseAuth()
      }
      const msg = params.get('message')
      const err = params.get('error')
      if (msg === 'password_updated') {
        setSuccessMessage('Password changed successfully! You can now sign in with your new password.')
      } else if (msg) {
        setSuccessMessage(msg)
      }
      if (err) {
        if (err === 'verification_failed') {
          setError('Verification failed or link expired. Please try again.')
        } else {
          setError(decodeURIComponent(err))
        }
      }
    }

    // Ensure body background is pure white on login page
    const originalBg = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#ffffff'
    return () => {
      document.body.style.backgroundColor = originalBg
    }
  }, [])

  const handleTermsCheckbox = (checked: boolean) => {
    setTermsAccepted(checked)
    // Clear the error when user checks the box
    if (checked && error === 'You must agree to the Terms and Conditions before logging in.') {
      setError('')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!termsAccepted) {
      setError('You must agree to the Terms and Conditions before logging in.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError(error.message || 'Login failed. Please try again.')
        setLoading(false)
      } else {
        // Check if the user has verified their email
        const user = data.user
        if (user && !user.email_confirmed_at) {
          clearAllSupabaseAuth()
          await supabase.auth.signOut({ scope: 'local' })
          fetch('/api/auth/signout', { method: 'POST' }).catch(() => {})
          setError('Please verify your email first. Check your inbox for the verification link.')
          setLoading(false)
          return
        }

        // Persist terms acceptance to localStorage
        setTermsAccepted(true)
        localStorage.setItem(
          TERMS_ACCEPTED_KEY,
          JSON.stringify({ version: TERMS_VERSION, accepted: true, acceptedAt: new Date().toISOString() })
        )

        // Save email if "Remember Me" is checked
        if (rememberMe) {
          const newSaved = [email, ...savedEmails.filter(e => e !== email)].slice(0, 5)
          localStorage.setItem('aics_saved_emails', JSON.stringify(newSaved))
          setSavedEmails(newSaved)
        }
        // Audit log the successful login
        try {
          await supabase.from('system_logs').insert({
            user_id: user.id,
            action: 'LOGIN',
            table_name: 'auth',
            details: { event: 'Successful login', email: user.email },
          })
        } catch { /* don't block login if logging fails */ }

        // Retrieve user role to route directly to their role-specific dashboard
        const { data: prof } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()

        let destination = '/resident/dashboard'
        if (!prof || !prof.is_active) {
          destination = '/pending'
        } else if (prof.role === 'admin') {
          destination = '/admin/dashboard'
        } else if (prof.role === 'treasurer') {
          destination = '/treasurer'
        }

        window.location.replace(destination)
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const isLoginDisabled = loading || !termsAccepted

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden bg-white" style={{ backgroundColor: '#ffffff' }} id="login-page">
      {/* Clean White Background Layer */}
      <div className="absolute inset-0 -z-10 bg-white" style={{ backgroundColor: '#ffffff' }} />

      {/* Left Panel - Branding (Desktop Only) */}
      <div className="hidden lg:flex lg:flex-1 relative items-center justify-center px-8 py-12">
        <div className="text-center relative z-10 max-w-lg">
          {/* Logos */}
          <div className="flex items-center justify-center gap-6 mb-12">
            <div className="animate-slideUp opacity-0" style={{ animationDelay: '0.1s' }}>
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                <Image
                  src="/dswd_logo.png"
                  alt="DSWD Logo"
                  width={80}
                  height={80}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <div className="w-px h-20 bg-gradient-to-b from-transparent via-slate-300 to-transparent" />
            <div className="animate-slideUp opacity-0" style={{ animationDelay: '0.2s' }}>
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                <Image
                  src="/aics_logo.png"
                  alt="AICS Logo"
                  width={80}
                  height={80}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <div className="w-px h-20 bg-gradient-to-b from-transparent via-slate-300 to-transparent" />
            <div className="animate-slideUp opacity-0" style={{ animationDelay: '0.25s' }}>
              <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                <Image
                  src="/bagong_pilipinas_logo.png"
                  alt="Bagong Pilipinas Logo"
                  width={88}
                  height={88}
                  className="object-contain w-[88px] h-[88px]"
                  priority
                />
              </div>
            </div>
          </div>

          {/* System Title */}
          <h1
            className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4 tracking-tight animate-slideUp opacity-0"
            style={{ animationDelay: '0.3s' }}
          >
            AICS Request Management and Beneficiary Information System
          </h1>

          {/* Subtitle */}
          <p
            className="text-xl text-blue-900 font-semibold animate-slideUp opacity-0"
            style={{ animationDelay: '0.4s' }}
          >
            Municipality of Daanbantayan – MSWD
          </p>

          {/* Decorative Line */}
          <div
            className="w-32 h-1.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto mt-8 animate-slideUp opacity-0"
            style={{ animationDelay: '0.5s' }}
          />

          {/* Tagline */}
          <p
            className="text-slate-600 text-lg mt-8 max-w-sm mx-auto leading-relaxed animate-slideUp opacity-0"
            style={{ animationDelay: '0.6s' }}
          >
            Managing requests and beneficiary information for the Municipality of Daanbantayan
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6">
              <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-sm">
                <Image src="/dswd_logo.png" alt="DSWD" width={50} height={50} className="object-contain" priority />
              </div>
              <div className="w-px h-12 bg-slate-300" />
              <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-sm">
                <Image src="/aics_logo.png" alt="AICS" width={50} height={50} className="object-contain" priority />
              </div>
              <div className="w-px h-12 bg-slate-300" />
              <div className="bg-white rounded-xl p-2 border border-slate-200/80 shadow-sm">
                <Image src="/bagong_pilipinas_logo.png" alt="Bagong Pilipinas" width={58} height={58} className="object-contain w-[58px] h-[58px]" priority />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">AICS System</h1>
            <p className="text-slate-600 font-medium">Municipality of Daanbantayan – MSWD</p>
          </div>

          {/* Login Card */}
          <div
            className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/60 hover:shadow-2xl hover:shadow-slate-200/80 transition-all duration-300 animate-slideUp opacity-0"
            style={{ animationDelay: '0.7s' }}
          >
            {/* Welcome Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h2>
              <p className="text-slate-500 text-sm">Sign in with your credentials to continue</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-5" id="login-form">

              {/* Email Field */}
              <div>
                <label htmlFor="login-email" className="block text-slate-700 text-sm font-semibold mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    required
                    autoComplete="off"
                    placeholder="your.email@example.com"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 focus:bg-white transition-all duration-200 text-sm"
                  />
                  {/* Email Suggestions */}
                  {showSuggestions && savedEmails.length > 0 && (
                    <ul className="absolute z-[60] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                      {savedEmails.map((savedEmail, idx) => (
                        <li
                          key={idx}
                          className="px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer transition-colors flex items-center"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setEmail(savedEmail)
                            setShowSuggestions(false)
                          }}
                        >
                          <CheckCircle2 size={14} className="mr-2 text-cyan-500 shrink-0" />
                          <span>{savedEmail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="login-password" className="block text-slate-700 text-sm font-semibold mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 focus:bg-white transition-all duration-200 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    id="toggle-password-visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Terms and Conditions Checkbox */}
              <div className="space-y-2" id="terms-section">
                <label className="flex items-start gap-3 cursor-pointer group" id="terms-checkbox-label">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => handleTermsCheckbox(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded border-slate-300 bg-white checked:bg-cyan-500 checked:border-cyan-500 cursor-pointer accent-cyan-500 shrink-0"
                    id="terms-checkbox"
                  />
                  <span className="text-slate-600 text-xs leading-relaxed group-hover:text-slate-800 transition-colors select-none">
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowTermsModal(true)
                      }}
                      className="text-cyan-600 hover:text-cyan-700 font-semibold underline underline-offset-2 decoration-cyan-500/40 hover:decoration-cyan-600 transition-colors inline-flex items-center gap-1"
                      id="view-terms-link"
                    >
                      <ScrollText size={12} className="inline" />
                      Terms and Conditions
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowTermsModal(true)
                      }}
                      className="text-cyan-600 hover:text-cyan-700 font-semibold underline underline-offset-2 decoration-cyan-500/40 hover:decoration-cyan-600 transition-colors"
                      id="view-privacy-link"
                    >
                      Privacy Policy
                    </button>{' '}
                    of the AICS Request Management and Beneficiary Information System.
                  </span>
                </label>
              </div>

              {/* Success Message */}
              {successMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex items-center gap-2.5">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <p className="font-medium">{successMessage}</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                  <p className="font-medium">⚠ {error}</p>
                </div>
              )}

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center text-slate-600 hover:text-slate-800 cursor-pointer transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 bg-white checked:bg-cyan-500 checked:border-cyan-500 cursor-pointer accent-cyan-500"
                  />
                  <span className="ml-2">Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoginDisabled}
                className={`w-full py-3 px-4 text-white font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-md transform active:scale-95 ${termsAccepted
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 hover:shadow-lg hover:shadow-cyan-500/25 hover:scale-[1.02]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  } disabled:hover:scale-100`}
                id="login-submit"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>

              {/* Terms not accepted hint */}
              {!termsAccepted && (
                <p className="text-center text-xs text-amber-600 flex items-center justify-center gap-1.5 font-medium">
                  <FileText size={12} />
                  Please accept the Terms and Conditions to continue
                </p>
              )}
            </form>

            <div className="text-center text-sm text-slate-500 mt-6">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-cyan-600 hover:text-cyan-700 font-semibold transition-colors">
                Sign up here
              </Link>
            </div>
          </div>

          {/* Security Notice */}
          <p className="text-center text-slate-500 text-xs mt-6 px-4">
            🔒 This is a secure government system. Authorized access only. All activities are logged and monitored.
          </p>
        </div>
      </div>

      {/* Terms & Conditions Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setTermsAccepted(true)
          if (error === 'You must agree to the Terms and Conditions before logging in.') {
            setError('')
          }
          setShowTermsModal(false)
        }}
      />

      {/* Custom Animations */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-slideUp {
          animation: slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .animate-fadeInBackdrop {
          animation: fadeInBackdrop 0.25s ease-out forwards;
        }

        .animate-modalSlideUp {
          animation: modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.04);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  )
}
