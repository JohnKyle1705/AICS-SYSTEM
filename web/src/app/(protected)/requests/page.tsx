'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Request } from '@/types'
import { ASSISTANCE_TYPES, REQUEST_STATUSES, STATUS_COLORS } from '@/lib/constants'
import { Plus, Search, FileText, Trash2, Calendar, Filter, X, ChevronLeft, ChevronRight, Eye, RefreshCw, ShieldCheck } from 'lucide-react'
import { format } from 'date-fns'
import { useLanguage } from '@/lib/LanguageContext'

const PAGE_SIZE = 10

function RequestsContent() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || ''

  const [rawRequests, setRawRequests] = useState<any[]>([])
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(initialStatus === 'All' ? '' : initialStatus)
  const [type, setType] = useState(searchParams.get('type') || '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const supabase = createClient()
  const { t } = useLanguage()

  // Sync state if URL query params change (e.g. from System Reports cards or Dashboard)
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

  // Reset pagination when any filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, status, type, dateFrom, dateTo])

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
      .select('*, beneficiaries(first_name, last_name, barangay, contact_number), payouts(release_date, amount_released)')
      .order('created_at', { ascending: false })

    // Residents can ONLY see their own requests
    if (profile.role === 'resident') {
      query = query.eq('encoded_by', profile.id)
    }

    if (status && status !== 'All') {
      query = query.eq('status', status)
    }
    if (type && type !== 'All') {
      query = query.eq('assistance_type', type)
    }
    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00`)
    }
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59`)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error loading requests:', error)
    }
    setRawRequests(data ?? [])
    setLoading(false)
  }, [status, type, dateFrom, dateTo, profile])

  useEffect(() => { load() }, [load])

  // Real-time synchronization when requests change
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    const debouncedLoad = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { load() }, 500)
    }

    const existing = supabase.getChannels().filter((c: any) => c.topic.includes('requests_page_realtime'))
    existing.forEach((c: any) => supabase.removeChannel(c))

    const channel = supabase
      .channel(`requests_page_realtime-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, debouncedLoad)
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [load])

  const filteredRequests = useMemo(() => {
    if (!search.trim()) return rawRequests
    const q = search.toLowerCase().trim()
    return rawRequests.filter((r: any) => {
      const benName = `${r.beneficiaries?.first_name || ''} ${r.beneficiaries?.last_name || ''}`.toLowerCase()
      const refNo = `ref-${(r.id || '').slice(0, 8)}`.toLowerCase()
      const fullId = (r.id || '').toLowerCase()
      const purpose = (r.purpose || '').toLowerCase()
      const barangay = (r.beneficiaries?.barangay || '').toLowerCase()
      return benName.includes(q) || refNo.includes(q) || fullId.includes(q) || purpose.includes(q) || barangay.includes(q)
    })
  }, [rawRequests, search])

  // Status counts for status filter pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: rawRequests.length, Pending: 0, Approved: 0, Released: 0, Declined: 0 }
    rawRequests.forEach((r: any) => {
      if (r.status && counts[r.status] !== undefined) {
        counts[r.status]++
      }
    })
    return counts
  }, [rawRequests])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE))
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredRequests.slice(start, start + PAGE_SIZE)
  }, [filteredRequests, currentPage])

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

  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setType('')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = Boolean(search || status || type || dateFrom || dateTo)

  // Title formatting based on role
  const getPageTitle = () => {
    if (profile?.role === 'resident') return t('requests_title_resident') || 'My Assistance Requests'
    if (profile?.role === 'treasurer') return 'All Assistance Requests'
    return t('requests_title_admin') || 'All Assistance Requests'
  }

  const getPageSubtitle = () => {
    if (profile?.role === 'resident') return `${filteredRequests.length} submitted requests`
    if (profile?.role === 'treasurer') return `Financial Monitoring & Oversight · ${filteredRequests.length} requests available`
    return `${filteredRequests.length} total recorded requests in system`
  }

  return (
    <div className="space-y-4 sm:space-y-5" id="requests-page">
      {/* Page Header */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] truncate">
              {getPageTitle()}
            </h1>
            {profile?.role === 'treasurer' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <ShieldCheck size={12} /> Financial Oversight
              </span>
            )}
          </div>
          <p className="text-[var(--color-text-secondary)] text-xs sm:text-sm mt-0.5">
            {getPageSubtitle()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {profile?.role === 'resident' && (
            <Link href="/requests/new" className="btn btn-primary text-sm shadow-sm" id="new-request-btn">
              <Plus size={16} /> {t('requests_newRequest')}
            </Link>
          )}
          <button
            onClick={() => load()}
            disabled={loading}
            className="p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors"
            title="Refresh requests"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Status Quick Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: '', label: 'All Requests', count: rawRequests.length },
          { key: 'Pending', label: 'Pending', count: statusCounts.Pending },
          { key: 'Approved', label: 'Approved', count: statusCounts.Approved },
          { key: 'Released', label: 'Released', count: statusCounts.Released },
          { key: 'Declined', label: 'Declined', count: statusCounts.Declined },
        ].map((tab) => {
          const isActive = status === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-slate-400 hover:text-[var(--color-text)]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="card p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          {/* Search field */}
          <div className="relative sm:col-span-2 lg:col-span-5">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search beneficiary name, Ref #, ID, purpose..."
              className="form-input pl-10 w-full text-xs sm:text-sm"
              id="request-search"
            />
          </div>

          {/* Assistance Type */}
          <div className="lg:col-span-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="form-input w-full text-xs sm:text-sm"
            >
              <option value="">All Assistance Types</option>
              {ASSISTANCE_TYPES.map(t => <option key={t} value={t}>{t} Assistance</option>)}
            </select>
          </div>

          {/* Date Range: From */}
          <div className="relative lg:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-input w-full text-xs sm:text-sm"
              title="Date submitted from"
            />
          </div>

          {/* Date Range: To */}
          <div className="relative lg:col-span-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="form-input w-full text-xs sm:text-sm"
              title="Date submitted to"
            />
          </div>

          {/* Clear button */}
          <div className="lg:col-span-1 flex items-center">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full h-full min-h-[38px] px-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900 transition-colors flex items-center justify-center gap-1"
                title="Clear all filters"
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Applied filters indicator */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-1 text-[var(--color-text-secondary)]">
            <span className="font-semibold text-slate-500">Active filters:</span>
            {search && <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Keyword: &ldquo;{search}&rdquo;</span>}
            {status && <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Status: {status}</span>}
            {type && <span className="badge bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">Type: {type}</span>}
            {dateFrom && <span className="badge bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">From: {dateFrom}</span>}
            {dateTo && <span className="badge bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">To: {dateTo}</span>}
            <span className="text-[11px] font-medium text-slate-400">({filteredRequests.length} results)</span>
          </div>
        )}
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
        ) : filteredRequests.length === 0 ? (
          <div className="card p-8 text-center">
            <FileText size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">{t('requests_noRequestsFound') || 'No requests found.'}</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing filters or search term.</p>
          </div>
        ) : (
          paginatedRequests.map((r: any) => {
            const refNo = `REF-${r.id.slice(0, 8).toUpperCase()}`
            const requestedAmt = r.amount_requested 
              ? `₱${Number(r.amount_requested).toLocaleString()}`
              : (r.extra_fields?.estimated_cost ? `₱${Number(r.extra_fields.estimated_cost).toLocaleString()}` : (r.extra_fields?.amount_range || '—'))
            const approvedAmt = r.amount_approved ? `₱${Number(r.amount_approved).toLocaleString()}` : '—'
            const releaseDate = r.payouts?.[0]?.release_date 
              ? format(new Date(r.payouts[0].release_date), 'MMM d, yyyy') 
              : (r.status === 'Released' ? 'Released' : '—')

            return (
              <div key={r.id} className="card p-4 space-y-3">
                {/* Header row: Ref & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {refNo}
                    </span>
                    <h3 className="font-bold text-[var(--color-text)] text-sm truncate mt-1">
                      {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {r.beneficiaries?.barangay || 'Daanbantayan'}
                    </p>
                  </div>
                  <span className={`badge ${STATUS_COLORS[r.status] || 'badge-pending'} shrink-0 text-[10px]`}>
                    {r.status}
                  </span>
                </div>

                {/* Assistance Type & Financial details */}
                <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-[var(--color-border)]">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 text-[10px] block uppercase font-medium">Assistance Type</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{r.assistance_type} Assistance</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 text-[10px] block uppercase font-medium">Date Submitted</span>
                    <span className="text-[var(--color-text)] font-medium">{format(new Date(r.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 text-[10px] block uppercase font-medium">Requested Amount</span>
                    <span className="text-[var(--color-text)] font-medium">{requestedAmt}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 text-[10px] block uppercase font-medium">Approved Amount</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{approvedAmt}</span>
                  </div>
                  {releaseDate !== '—' && (
                    <div className="col-span-2 pt-1 border-t border-[var(--color-border)] flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400 text-[10px] uppercase font-medium">Release Date:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">{releaseDate}</span>
                    </div>
                  )}
                </div>

                {r.purpose && (
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                    <strong className="text-[var(--color-text)]">Purpose:</strong> {r.purpose}
                  </p>
                )}

                {r.status === 'Declined' && r.remarks && (
                  <p className="text-xs text-red-500 italic bg-red-50/50 dark:bg-red-900/20 p-2 rounded-lg">
                    Reason: {r.remarks}
                  </p>
                )}

                {/* Footer action buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                  <Link
                    href={`/requests/${r.id}`}
                    className="btn btn-primary py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Eye size={13} /> {t('view') || 'View'} Details
                  </Link>

                  {(profile?.role === 'admin' || (profile?.role === 'resident' && r.status === 'Pending')) && (
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
            )
          })
        )}
      </div>

      {/* Desktop Data Table (hidden on < md) */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" id="requests-table">
            <thead>
              <tr>
                <th className="w-28">Ref #</th>
                <th>Beneficiary Name</th>
                <th>Assistance Type</th>
                <th>Requested</th>
                <th>Approved</th>
                <th>Date Submitted</th>
                <th>Status</th>
                <th>Release Date</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j}><div className="skeleton h-5 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <FileText size={36} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">{t('requests_noRequestsFound') || 'No requests found.'}</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing your filters or search terms.</p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((r: any) => {
                  const refNo = `REF-${r.id.slice(0, 8).toUpperCase()}`
                  const requestedAmt = r.amount_requested 
                    ? `₱${Number(r.amount_requested).toLocaleString()}`
                    : (r.extra_fields?.estimated_cost ? `₱${Number(r.extra_fields.estimated_cost).toLocaleString()}` : (r.extra_fields?.amount_range || '—'))
                  const approvedAmt = r.amount_approved ? `₱${Number(r.amount_approved).toLocaleString()}` : '—'
                  const releaseDate = r.payouts?.[0]?.release_date 
                    ? format(new Date(r.payouts[0].release_date), 'MMM d, yyyy') 
                    : (r.status === 'Released' ? 'Released' : '—')

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Ref # */}
                      <td>
                        <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {refNo}
                        </span>
                      </td>

                      {/* Beneficiary */}
                      <td>
                        <div className="font-medium text-[var(--color-text)]">
                          {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-secondary)]">
                          {r.beneficiaries?.barangay || 'Daanbantayan'}
                        </div>
                      </td>

                      {/* Type */}
                      <td>
                        <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs">
                          {r.assistance_type} Assistance
                        </span>
                      </td>

                      {/* Requested */}
                      <td className="text-xs font-medium text-[var(--color-text)]">
                        {requestedAmt}
                      </td>

                      {/* Approved */}
                      <td>
                        {r.amount_approved ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            {approvedAmt}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Date Submitted */}
                      <td className="text-slate-600 dark:text-slate-400 text-xs">
                        {format(new Date(r.created_at), 'MMM d, yyyy')}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge ${STATUS_COLORS[r.status] || 'badge-pending'}`}>
                          {r.status}
                        </span>
                      </td>

                      {/* Release Date */}
                      <td className="text-xs">
                        {releaseDate !== '—' ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {releaseDate}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/requests/${r.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                          >
                            <Eye size={12} /> {t('view') || 'View'}
                          </Link>

                          {(profile?.role === 'admin' || (profile?.role === 'resident' && r.status === 'Pending')) && (
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title={t('delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredRequests.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex-wrap gap-2 text-xs">
            <span className="text-[var(--color-text-secondary)]">
              Showing <strong className="text-[var(--color-text)]">{Math.min(filteredRequests.length, (currentPage - 1) * PAGE_SIZE + 1)}</strong> to{' '}
              <strong className="text-[var(--color-text)]">{Math.min(filteredRequests.length, currentPage * PAGE_SIZE)}</strong> of{' '}
              <strong className="text-[var(--color-text)]">{filteredRequests.length}</strong> requests
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={13} /> Prev
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1
                if (
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                }
                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return <span key={pageNum} className="text-slate-400 px-1">...</span>
                }
                return null
              })}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
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
