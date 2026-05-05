'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, PlusCircle, Clock, CheckCircle, HelpCircle, Users, Megaphone, Calendar, X, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import { useLanguage } from '@/lib/LanguageContext'


export default function ResidentDashboard() {
  const { t } = useLanguage()
  const [profile, setProfile] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null)
  const [hasBeneficiaryRecord, setHasBeneficiaryRecord] = useState(true)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [p, reqs, b, anns] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('requests').select('*').eq('encoded_by', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('beneficiaries').select('id').eq('created_by', user.id).maybeSingle(),
        supabase.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(3)
      ])

      setProfile(p.data)
      setRequests(reqs.data ?? [])
      setHasBeneficiaryRecord(!!b.data)
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg border-2 border-white dark:border-slate-800">
              {profile?.full_name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('dashboard_welcome')}, {profile?.full_name?.split(' ')[0]}!</h1>
            <p className="text-[var(--color-text-secondary)] text-sm">{t('dashboard_residentSubtitle')}</p>
          </div>
        </div>
        <Link href="/requests/new" className="btn btn-primary px-6 shadow-lg shadow-blue-500/20">
          <PlusCircle size={18} /> {t('newRequest_title')}
        </Link>

      </div>

      {!hasBeneficiaryRecord && !loading && (
        <div className="card p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
              <Users size={32} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold mb-2">{t('dashboard_completeRegistration')}</h2>
              <p className="text-blue-100 text-sm leading-relaxed max-w-md">
                {t('dashboard_completeRegistrationDesc')}
              </p>
            </div>
            <Link href="/beneficiaries/new" className="bg-white text-blue-700 px-8 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors shadow-lg">
              {t('dashboard_startRegistration')}
            </Link>

          </div>
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
                <Link href="/requests/new" className="text-blue-600 font-bold mt-4 inline-block">{t('dashboard_createFirst')}</Link>
              </div>

            ) : (
              requests.map(r => (
                <Link key={r.id} href={`/requests/${r.id}`} className="card p-5 flex items-center justify-between hover:border-blue-300 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center 
                      ${r.status === 'Released' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                      {r.status === 'Released' ? <CheckCircle size={20}/> : <Clock size={20}/>}
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-text)] text-sm">{r.assistance_type} {t('assistance')}</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('dashboard_filedOn')} {new Date(r.created_at).toLocaleDateString()}</p>
                    </div>

                  </div>
                  <div className="text-right">
                    <span className={`badge text-[10px] uppercase font-bold
                      ${r.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 
                        r.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                        r.status === 'Released' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-red-100 text-red-700'}`}>
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
                        <img src={ann.image_url} alt="" className="w-full h-full object-cover" />
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
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-2xl shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface)] sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <Megaphone size={18} className="text-indigo-500" />
                <h2 className="font-bold text-lg text-[var(--color-text)]">{t('dashboard_systemUpdate')}</h2>
              </div>
              <button onClick={() => setSelectedAnnouncement(null)} className="p-1 hover:bg-[var(--color-surface-hover)] rounded-full transition-colors text-[var(--color-text-secondary)]">
                <X size={20} />
              </button>

            </div>
            
            <div className="p-0 overflow-y-auto">
              {selectedAnnouncement.image_url && (
                <div className="w-full aspect-video border-b border-[var(--color-border)]">
                  <img src={selectedAnnouncement.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-8">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">
                  <Calendar size={14} />
                  {format(new Date(selectedAnnouncement.created_at), 'MMMM d, yyyy • h:mm a')}
                </div>
                <h1 className="text-2xl font-black text-[var(--color-text)] mb-6 leading-tight">{selectedAnnouncement.title}</h1>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  {selectedAnnouncement.content.split('\n').map((para: string, i: number) => (
                    <p key={i} className="text-[var(--color-text-secondary)] leading-relaxed text-[15px] mb-4 last:mb-0">{para}</p>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="px-8 py-6 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end">
              <button 
                onClick={() => setSelectedAnnouncement(null)}
                className="btn bg-slate-100 dark:bg-slate-800 text-[var(--color-text)] px-8 py-2.5 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                {t('close')}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
