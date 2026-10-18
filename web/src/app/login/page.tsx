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
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-gradient-to-br from-slate-900/95 via-blue-950/95 to-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl shadow-blue-900/30 animate-modalSlideUp overflow-hidden"
        id="terms-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Terms and Conditions</h2>
              <p className="text-xs text-white/50">AICS Request Management System — v{TERMS_VERSION}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all duration-200"
            aria-label="Close terms modal"
            id="close-terms-modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 custom-scrollbar">
          {/* Preamble */}
          <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-400/20 rounded-xl">
            <p className="text-sm text-cyan-100/90 leading-relaxed">
              By accessing and using the <strong className="text-cyan-300">AICS Request Management and Beneficiary Information System</strong>, you acknowledge that you have read, understood, and agree to be bound by the following terms and conditions.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-5">
            {TERMS_SECTIONS.map((section, idx) => (
              <div
                key={idx}
                className="group p-5 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-2xl transition-all duration-300"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl shrink-0 mt-0.5">{section.icon}</span>
                  <h3 className="text-base font-bold text-white/90 group-hover:text-white transition-colors">
                    {idx + 1}. {section.title}
                  </h3>
                </div>
                <p className="text-sm text-white/65 leading-relaxed pl-9">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {/* Footer Notice */}
          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-400/20 rounded-xl">
            <p className="text-xs text-amber-200/80 leading-relaxed">
              <strong className="text-amber-300">Note:</strong> These terms may be updated from time to time. Continued use of the system after changes constitutes acceptance of the revised terms. You will be prompted to re-accept when terms are updated.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 sm:px-8 py-4 border-t border-white/10 bg-white/5 shrink-0">
          <button
            onClick={() => {
              if (onAccept) onAccept()
              else onClose()
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95"
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

        // Redirect to dashboard
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const isLoginDisabled = loading || !termsAccepted

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden" id="login-page">
      {/* Animated Background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e40af 100%)',
        }}
      >
        {/* Animated background shapes */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Left Panel - Branding (Desktop Only) */}
      <div className="hidden lg:flex lg:flex-1 relative items-center justify-center px-8 py-12">
        <div className="text-center relative z-10">
          {/* Logos */}
          <div className="flex items-center justify-center gap-6 mb-12">
            <div className="animate-slideUp opacity-0" style={{ animationDelay: '0.1s' }}>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105">
                <Image
                  src="/dswd_logo.png"
                  alt="DSWD Logo"
                  width={80}
                  height={80}
                  className="object-contain drop-shadow-lg"
                  priority
                />
              </div>
            </div>
            <div className="w-1 h-24 bg-linear-to-b from-transparent via-white/40 to-transparent" />
            <div className="animate-slideUp opacity-0" style={{ animationDelay: '0.2s' }}>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105">
                <Image
                  src="/aics_logo.png"
                  alt="AICS Logo"
                  width={80}
                  height={80}
                  className="object-contain drop-shadow-lg"
                  priority
                />
              </div>
            </div>
          </div>

          {/* System Title */}
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight drop-shadow-lg animate-slideUp opacity-0"
            style={{ animationDelay: '0.3s' }}>
            AICS Request Management and Beneficiary Information System
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-blue-100 font-semibold drop-shadow-md animate-slideUp opacity-0"
            style={{ animationDelay: '0.4s' }}>
            Municipality of Daanbantayan – MSWD
          </p>

          {/* Decorative Line */}
          <div className="w-32 h-1.5 bg-linear-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-8 animate-slideUp opacity-0"
            style={{ animationDelay: '0.5s' }} />

          {/* Tagline */}
          <p className="text-white/70 text-lg mt-8 max-w-sm mx-auto leading-relaxed animate-slideUp opacity-0"
            style={{ animationDelay: '0.6s' }}>
            Managing requests and beneficiary information for the Municipality of Daanbantayan
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3">
                <Image src="/dswd_logo.png" alt="DSWD" width={50} height={50} className="object-contain drop-shadow-lg" priority />
              </div>
              <div className="w-px h-12 bg-white/30" />
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3">
                <Image src="/aics_logo.png" alt="AICS" width={50} height={50} className="object-contain drop-shadow-lg" priority />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">AICS System</h1>
            <p className="text-blue-100">Municipality of Daanbantayan – MSWD</p>
          </div>

          {/* Login Card */}
          <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-3xl p-8 sm:p-10 shadow-2xl hover:shadow-3xl hover:bg-white/12 transition-all duration-300 animate-slideUp opacity-0"
            style={{ animationDelay: '0.7s' }}>

            {/* Welcome Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
              <p className="text-white/70">Sign in with your credentials to continue</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-5" id="login-form">

              {/* Email Field */}
              <div>
                <label htmlFor="login-email" className="block text-white/80 text-sm font-semibold mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
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
                    className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 focus:bg-white/15 transition-all duration-300"
                  />
                  {/* Email Suggestions */}
                  {showSuggestions && savedEmails.length > 0 && (
                    <ul className="absolute z-[60] w-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                      {savedEmails.map((savedEmail, idx) => (
                        <li
                          key={idx}
                          className="px-4 py-3 text-sm text-white/90 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setEmail(savedEmail)
                            setShowSuggestions(false)
                          }}
                        >
                          <CheckCircle2 size={14} className="inline mr-2 text-cyan-400" />
                          {savedEmail}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="login-password" className="block text-white/80 text-sm font-semibold mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 focus:bg-white/15 transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors p-1 rounded"
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
                    className="w-5 h-5 mt-0.5 rounded border-white/30 bg-white/10 checked:bg-cyan-500 checked:border-cyan-500 cursor-pointer accent-cyan-500 shrink-0"
                    id="terms-checkbox"
                  />
                  <span className="text-white/70 text-xs leading-relaxed group-hover:text-white/90 transition-colors select-none">
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowTermsModal(true)
                      }}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 decoration-cyan-400/40 hover:decoration-cyan-300/60 transition-colors inline-flex items-center gap-1"
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
                      className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 decoration-cyan-400/40 hover:decoration-cyan-300/60 transition-colors"
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
                <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 text-sm px-4 py-3 rounded-lg backdrop-blur-sm flex items-center gap-2.5">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  <p className="font-medium">{successMessage}</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/40 text-red-100 text-sm px-4 py-3 rounded-lg backdrop-blur-sm animate-pulse">
                  <p className="font-medium">⚠ {error}</p>
                </div>
              )}

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center text-white/70 hover:text-white cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/30 bg-white/10 checked:bg-cyan-500 checked:border-cyan-500 cursor-pointer accent-cyan-500"
                  />
                  <span className="ml-2">Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-cyan-300 hover:text-cyan-200 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoginDisabled}
                className={`w-full py-3 px-4 text-white font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg transform active:scale-95 ${termsAccepted
                    ? 'bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 hover:shadow-xl hover:scale-105'
                    : 'bg-gradient-to-r from-slate-600/50 to-slate-700/50 cursor-not-allowed shadow-md'
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
                <p className="text-center text-xs text-amber-300/70 flex items-center justify-center gap-1.5">
                  <FileText size={12} />
                  Please accept the Terms and Conditions to continue
                </p>
              )}
            </form>

            <div className="text-center text-sm text-white/60 mt-6">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-cyan-300 hover:text-cyan-200 font-semibold transition-colors">
                Sign up here
              </Link>
            </div>
          </div>

          {/* Security Notice */}
          <p className="text-center text-white/40 text-xs mt-6 px-4">
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

        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
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

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animate-fadeInBackdrop {
          animation: fadeInBackdrop 0.25s ease-out forwards;
        }

        .animate-modalSlideUp {
          animation: modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </div>
  )
}
