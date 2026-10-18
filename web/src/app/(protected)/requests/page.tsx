'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Request } from '@/types'
import { ASSISTANCE_TYPES, REQUEST_STATUSES, STATUS_COLORS } from '@/lib/constants'
import { Plus, Search, FileText, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useLanguage } from '@/lib/LanguageContext'

function RequestsContent() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || ''

  const [rawRequests, setRawRequests] = useState<Request[]>([])
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(initialStatus === 'All' ? '' : initialStatus)
  const [type, setType] = useState(searchParams.get('type') || '')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const supabase = createClient()
  const { t } = useLanguage()

  const requests = useMemo(() => {
    if (!search.trim()) return rawRequests
    const q = search.toLowerCase()
    return rawRequests.filter((r: any) =>
      `${r.beneficiaries?.first_name || ''} ${r.beneficiaries?.last_name || ''}`.toLowerCase().includes(q) ||
      (r.tracking_code && r.tracking_code.toLowerCase().includes(q))
    )
  }, [rawRequests, search])

  // Sync state if URL query params change (e.g. from System Reports cards)
  useEffect(() => {
    const s = searchParams.get('status')
    if (s !== null) {
      setStatus(s === 'All' ? '' : s)
    }
    const q = searchParams.get('search')
    if (q !== null) {
      setSearch(q)
    }
    const tp = searchParams.get('type')
    if (tp !== null) {
      setType(tp)
    }
  }, [searchParams])

  // Load profile first
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
      }
    }
    loadProfile()
  }, [])

  const load = useCallback(async () => {
    if (!profile) return // Wait for profile to load
    setLoading(true)

    let query = supabase.from('requests')
      .select('*, beneficiaries(first_name, last_name, barangay)')
      .order('created_at', { ascending: false })

    // Residents can ONLY see their own requests
    if (profile.role === 'resident') {
      query = query.eq('encoded_by', profile.id)
    }

    if (status) {
      if (status === 'Approved') {
        query = query.in('status', ['Approved', 'Released'])
      } else {
        query = query.eq('status', status)
      }
    }
    if (type) query = query.eq('assistance_type', type)
    const { data } = await query
    setRawRequests(data ?? [])
    setLoading(false)
  }, [status, type, profile])

  useEffect(() => { load() }, [load])

  // Real-time synchronization when requests change
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    const debouncedLoad = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { load() }, 500)
    }

    const channel = supabase
      .channel('requests_page_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, debouncedLoad)
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [load])

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('requests_deleteConfirm') || 'Are you sure you want to delete this request?\nThis action cannot be undone.')) return
    
    setLoading(true)
    const { error } = await supabase.from('requests').delete().eq('id', id)
    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }
    
    setRawRequests(prev => prev.filter(r => r.id !== id))
    alert(t('requests_deleteSuccess') || 'Request deleted successfully.')
    setLoading(false)
  }

  return (
    <div className="space-y-4 sm:space-y-5" id="requests-page">
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] truncate">
            {profile?.role === 'resident' ? t('requests_title_resident') : t('requests_title_admin')}
          </h1>
          <p className="text-[var(--color-text-secondary)] text-xs sm:text-sm mt-0.5">{requests.length} {t('nav_requests').toLowerCase()}</p>
        </div>
        {profile?.role === 'resident' && (
          <Link href="/requests/new" className="btn btn-primary text-sm" id="new-request-btn">
            <Plus size={16} /> {t('requests_newRequest')}
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('requests_searchPlaceholder')} className="form-input pl-10 w-full" id="request-search" />
        </div>
        <div className="flex gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="form-input flex-1 sm:flex-none sm:min-w-[150px]">
            <option value="">{t('requests_allTypes')}</option>
            {ASSISTANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input flex-1 sm:flex-none sm:min-w-[150px]">
            <option value="">{t('requests_allStatuses')}</option>
            {REQUEST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Mobile Card List View (visible on < md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="skeleton h-5 w-3/4 rounded-lg" />
              <div className="skeleton h-4 w-1/2 rounded-lg" />
              <div className="skeleton h-8 w-full rounded-lg" />
            </div>
          ))
        ) : requests.length === 0 ? (
          <div className="card p-8 text-center">
            <FileText size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('requests_noRequestsFound')}</p>
          </div>
        ) : (
          requests.map((r: any) => (
            <div key={r.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-[var(--color-text)] text-sm truncate">
                    {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {format(new Date(r.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <span className={`badge ${STATUS_COLORS[r.status]} shrink-0 text-[10px]`}>
                  {r.status}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  {r.assistance_type}
                </span>
                <span className="text-[var(--color-text-secondary)]">·</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {(r.status === 'Approved' || r.status === 'Released') && r.amount_approved ? (
                    <span className="text-emerald-600 dark:text-emerald-400">₱{Number(r.amount_approved).toLocaleString()}</span>
                  ) : r.amount_requested ? (
                    `₱${Number(r.amount_requested).toLocaleString()}`
                  ) : (
                    '—'
                  )}
                </span>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                {r.purpose}
              </p>

              {r.status === 'Declined' && r.remarks && (
                <p className="text-xs text-red-500 italic bg-red-50/50 dark:bg-red-900/20 p-2 rounded-lg">
                  Reason: {r.remarks}
                </p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                <Link
                  href={`/requests/${r.id}`}
                  className="btn btn-primary py-2 px-4 text-xs font-semibold"
                >
                  {t('view')} {t('details')}
                </Link>
                {(profile?.role === 'admin' || profile?.role === 'resident') && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    title={t('delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Data Table (hidden on < md) */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" id="requests-table">
            <thead>
              <tr>
                {[t('requests_beneficiary'), t('requests_type'), t('requests_purpose'), t('requests_amount'), t('requests_status'), t('requests_date'), t('actions')].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="skeleton h-5 w-full" /></td>)}</tr>
                ))
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <FileText size={36} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{t('requests_noRequestsFound')}</p>
                  </td>
                </tr>
              ) : requests.map((r: any) => (
                <tr key={r.id}>
                  <td className="font-medium text-[var(--color-text)]">
                    {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
                  </td>
                  <td><span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{r.assistance_type}</span></td>
                  <td className="max-w-[220px]">
                    <div className="truncate font-medium">{r.purpose}</div>
                    {r.status === 'Declined' && r.remarks && (
                      <div className="text-xs text-red-500 italic mt-0.5 truncate" title={r.remarks}>
                        Reason: {r.remarks}
                      </div>
                    )}
                  </td>
                  <td>
                    {(r.status === 'Approved' || r.status === 'Released') && r.amount_approved ? (
                      <div>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          ₱{Number(r.amount_approved).toLocaleString()}
                        </span>
                        <span className="block text-[10px] text-[var(--color-text-secondary)] uppercase">Approved</span>
                      </div>
                    ) : r.amount_requested ? (
                      `₱${Number(r.amount_requested).toLocaleString()}`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td><span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                  <td className="text-slate-500 text-xs">{format(new Date(r.created_at), 'MMM d, yyyy')}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Link href={`/requests/${r.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline">
                        {t('view')}
                      </Link>
                      {(profile?.role === 'admin' || profile?.role === 'resident') && (
                        <button 
                          onClick={() => handleDelete(r.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--color-text-secondary)]">Loading requests...</div>}>
      <RequestsContent />
    </Suspense>
  )
}
