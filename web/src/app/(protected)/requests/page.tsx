'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Request } from '@/types'
import { ASSISTANCE_TYPES, REQUEST_STATUSES, STATUS_COLORS } from '@/lib/constants'
import { Plus, Search, FileText, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useLanguage } from '@/lib/LanguageContext'

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const supabase = createClient()
  const { t } = useLanguage()

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
    const { data: { user } } = await supabase.auth.getUser()

    let query = supabase.from('requests')
      .select('*, beneficiaries(first_name, last_name, barangay)')
      .order('created_at', { ascending: false })

    // Residents can ONLY see their own requests
    if (profile.role === 'resident' && user) {
      query = query.eq('encoded_by', user.id)
    }

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('assistance_type', type)
    const { data } = await query
    const filtered = search
      ? (data ?? []).filter((r: any) =>
          `${r.beneficiaries?.first_name} ${r.beneficiaries?.last_name}`.toLowerCase().includes(search.toLowerCase()))
      : (data ?? [])
    setRequests(filtered)
    setLoading(false)
  }, [search, status, type, profile])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('requests_deleteConfirm') || 'Are you sure you want to delete this request?\nThis action cannot be undone.')) return
    
    setLoading(true)
    const { error } = await supabase.from('requests').delete().eq('id', id)
    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }
    
    setRequests(prev => prev.filter(r => r.id !== id))
    alert(t('requests_deleteSuccess') || 'Request deleted successfully.')
    setLoading(false)
  }

  return (
    <div className="space-y-5" id="requests-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {profile?.role === 'resident' ? t('requests_title_resident') : t('requests_title_staff')}
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">{requests.length} {t('nav_requests').toLowerCase()}</p>
        </div>
        {profile?.role === 'resident' && (
          <Link href="/requests/new" className="btn btn-primary" id="new-request-btn">
            <Plus size={16} /> {t('requests_newRequest')}
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('requests_searchPlaceholder')} className="form-input pl-10" id="request-search" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="form-input w-auto min-w-[150px]">
          <option value="">{t('requests_allTypes')}</option>
          {ASSISTANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input w-auto min-w-[150px]">
          <option value="">{t('requests_allStatuses')}</option>
          {REQUEST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
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
                  <td className="max-w-[180px] truncate">{r.purpose}</td>
                  <td>{r.amount_requested ? `₱${Number(r.amount_requested).toLocaleString()}` : '—'}</td>
                  <td><span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                  <td className="text-slate-500 text-xs">{format(new Date(r.created_at), 'MMM d, yyyy')}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Link href={`/requests/${r.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline">
                        {t('view')}
                      </Link>
                      {(profile?.role === 'admin' || profile?.role === 'staff' || profile?.role === 'resident') && (
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
