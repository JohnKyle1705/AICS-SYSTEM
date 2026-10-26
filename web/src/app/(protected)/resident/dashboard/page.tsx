'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { FileText, PlusCircle, Clock, CheckCircle, HelpCircle, Users, Megaphone, Calendar, X, ChevronRight, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import { useLanguage } from '@/lib/LanguageContext'


export default function ResidentDashboard() {
  const { t } = useLanguage()
  const [profile, setProfile] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null)
  const [hasBeneficiaryRecord, setHasBeneficiaryRecord] = useState<boolean | null>(null)
  const [beneficiary, setBeneficiary] = useState<any>(null)
  const [showRegModal, setShowRegModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      const [p, reqs, b, anns] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('requests').select('*').eq('encoded_by', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('beneficiaries').select('*').eq('created_by', user.id).maybeSingle(),
        supabase.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(3)
      ])

      const prof = p.data
      if (prof && prof.role !== 'resident') {
        window.location.replace(prof.role === 'admin' ? '/admin/dashboard' : '/treasurer')
        return
      }

      setProfile(prof)
      setRequests(reqs.data ?? [])
      setHasBeneficiaryRecord(!!b.data)
      setBeneficiary(b.data ?? null)
      setAnnouncements(anns.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-lg relative">
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg border-2 border-white dark:border-slate-800">
              {profile?.full_name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('dashboard_welcome')}, {profile?.full_name?.split(' ')[0]}!</h1>
            <p className="text-[var(--color-text-secondary)] text-sm">{t('dashboard_residentSubtitle')}</p>
          </div>
        </div>

        {/* New AICS Request Button — Gated by Beneficiary Registration */}
        {hasBeneficiaryRecord ? (
          <Link href="/requests/new" className="btn btn-primary px-6 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 w-full sm:w-auto">
            <PlusCircle size={18} /> {t('newRequest_title')}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setShowRegModal(true)}
            className="btn bg-blue-600/40 hover:bg-blue-600/60 text-white/80 cursor-pointer px-6 shadow-md flex items-center justify-center gap-2 border border-blue-400/25 transition-all w-full sm:w-auto"
            title="Complete beneficiary registration first"
          >
            <Lock size={16} className="text-blue-200" />
            <span>{t('newRequest_title')}</span>
          </button>
        )}
      </div>

      {/* ── Registration Card ────────────────────────────────────── */}
      {!hasBeneficiaryRecord && !loading && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-slate-900 dark:to-[#0c1322] border border-blue-500/30 dark:border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 transition-all">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/15 dark:bg-slate-800/90 border border-white/20 dark:border-slate-700/60 flex items-center justify-center shrink-0 text-white dark:text-slate-300 shadow-inner">
              <Users size={28} className="text-white dark:text-slate-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Complete Your Registration</h2>
              <p className="text-blue-100 dark:text-slate-400 text-sm leading-relaxed max-w-xl">
                Please complete your beneficiary registration to unlock AICS request capabilities.
              </p>
            </div>
          </div>
          <Link
            href="/beneficiaries/new"
            className="bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-md shrink-0 self-stretch sm:self-auto text-center"
          >
            Start Registration
          </Link>
        </div>
      )}

      {/* ── Verified Card (Replaces Registration Warning) ──────── */}
      {hasBeneficiaryRecord && !loading && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Beneficiary Registration Verified</h3>
                <span className="badge bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                  Verified
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                Profile registered for <span className="text-slate-900 dark:text-slate-200 font-semibold">{beneficiary?.first_name} {beneficiary?.last_name}</span> ({beneficiary?.barangay}) · Ready for Medical &amp; Burial assistance requests.
              </p>
            </div>
          </div>
          <Link
            href="/requests/new"
            className="btn btn-primary text-xs px-4 py-2 rounded-lg font-semibold shrink-0 flex items-center gap-1.5 shadow-md"
          >
            <PlusCircle size={14} /> New Request
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[var(--color-text)] text-lg">{t('dashboard_myRecentRequests')}</h2>
            <Link href="/requests" className="text-sm text-blue-600 hover:underline">{t('dashboard_seeHistory')}</Link>
          </div>


          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)
            ) : requests.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText size={24} className="text-slate-400" />
                </div>
                <p className="text-[var(--color-text-secondary)] text-sm">{t('dashboard_noRequests')}</p>
                {hasBeneficiaryRecord ? (
                  <Link href="/requests/new" className="text-blue-600 font-bold mt-4 inline-block">{t('dashboard_createFirst')}</Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRegModal(true)}
                    className="text-blue-600 font-bold mt-4 inline-block hover:underline cursor-pointer"
                  >
                    {t('dashboard_createFirst')}
                  </button>
                )}
              </div>

            ) : (
              requests.map(r => (
                <Link key={r.id} href={`/requests/${r.id}`} className="card p-5 flex items-center justify-between hover:border-blue-300 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center 
                      ${r.status === 'Released' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'}`}>
                      {r.status === 'Released' ? <CheckCircle size={20} /> : <Clock size={20} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-text)] text-sm">{r.assistance_type} {t('assistance')}</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('dashboard_filedOn')} {new Date(r.created_at).toLocaleDateString()}</p>
                    </div>

                  </div>
                  <div className="text-right">
                    <span className={`badge text-[10px] uppercase font-bold
                      ${r.status === 'Pending' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' :
                        r.status === 'Approved' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' :
                          r.status === 'Released' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' :
                            'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'}`}>
                      {r.status}
                    </span>
                    <p className="text-xs font-semibold text-[var(--color-text)] mt-1 group-hover:text-blue-600 transition-colors">{t('details')} →</p>
                  </div>

                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[var(--color-text)] text-lg">{t('dashboard_latestUpdates')}</h2>
          </div>


          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)
            ) : announcements.length === 0 ? (
              <div className="card p-6 bg-slate-50/50 dark:bg-slate-900/10 border-dashed border-2">
                <p className="text-xs text-center text-[var(--color-text-secondary)]">{t('dashboard_noAnnouncements')}</p>
              </div>

            ) : (
              announcements.map(ann => (
                <button
                  key={ann.id}
                  onClick={() => setSelectedAnnouncement(ann)}
                  className="card p-4 text-left hover:border-indigo-300 transition-all group w-full"
                >
                  <div className="flex gap-4">
                    {ann.image_url && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-sm border border-[var(--color-border)]">
                        <img
                          src={ann.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-[var(--color-text)] line-clamp-1 group-hover:text-indigo-600 transition-colors">{ann.title}</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2 leading-relaxed">{ann.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Calendar size={12} className="text-[var(--color-text-secondary)]" />
                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase">{format(new Date(ann.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="card p-6 bg-blue-50/30 dark:bg-blue-900/10 border-blue-100/50 dark:border-blue-800/50">
            <h4 className="text-sm font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
              <HelpCircle size={16} className="text-blue-500" /> {t('dashboard_needHelp')}
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4 leading-relaxed">
              {t('dashboard_needHelpDesc')}
            </p>
            <button className="text-xs font-bold text-blue-600 hover:underline">{t('dashboard_contactSupport')}</button>
          </div>

        </div>
      </div>

      {/* Announcement Detail Modal */}
      {mounted && selectedAnnouncement && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 backdrop-blur-sm p-3 sm:p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAnnouncement(null)
          }}
        >
          <div className="min-h-full flex items-center justify-center py-4 sm:py-6">
            <div
              className="card w-full max-w-2xl shadow-2xl p-0 overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col my-auto border border-[var(--color-border)] bg-[var(--color-surface)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface)] shrink-0">
                <div className="flex items-center gap-3">
                  <Megaphone size={18} className="text-indigo-500" />
                  <h2 className="font-bold text-lg text-[var(--color-text)]">{t('dashboard_systemUpdate')}</h2>
                </div>
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="p-1 hover:bg-[var(--color-surface-hover)] rounded-full transition-colors text-[var(--color-text-secondary)]"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {selectedAnnouncement.image_url && (
                  <div className="w-full aspect-video border-b border-[var(--color-border)]">
                    <img
                      src={selectedAnnouncement.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget.parentElement as HTMLElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}
                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">
                    <Calendar size={14} />
                    {format(new Date(selectedAnnouncement.created_at), 'MMMM d, yyyy • h:mm a')}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-4 leading-tight">{selectedAnnouncement.title}</h1>
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    {selectedAnnouncement.content.split('\n').map((para: string, i: number) => (
                      <p key={i} className="text-[var(--color-text-secondary)] leading-relaxed text-[15px] mb-4 last:mb-0">{para}</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end shrink-0">
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="btn bg-slate-100 dark:bg-slate-800 text-[var(--color-text)] px-8 py-2.5 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Beneficiary Registration Required Modal */}
      {mounted && showRegModal && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRegModal(false)
          }}
        >
          <div className="min-h-full flex items-center justify-center py-4">
            <div
              className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-scale-in my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Beneficiary Registration Required</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                  You must complete your beneficiary registration before submitting an AICS request.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <Link
                  href="/beneficiaries/new"
                  className="btn btn-primary w-full py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 text-center"
                >
                  Complete Registration
                </Link>
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  className="w-full py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
