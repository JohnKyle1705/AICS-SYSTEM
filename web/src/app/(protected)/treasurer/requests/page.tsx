'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ASSISTANCE_TYPES, BARANGAYS } from '@/lib/constants'
import {
  Search, FileText, CheckCircle, AlertCircle, Clock, RotateCcw,
  Filter, Download, ChevronRight, X, ArrowUpDown, Banknote,
  Calendar, Eye, XCircle, CheckCircle2, User, Phone, MapPin, Building, ClipboardList
} from 'lucide-react'
import { format } from 'date-fns'

const RELEASE_STATUSES = ['Pending Release', 'Ready for Release', 'Released']

const RELEASE_STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  'Released':          { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  'Ready for Release': { bg: 'bg-amber-100 dark:bg-amber-900/30',    text: 'text-amber-700 dark:text-amber-400',     border: 'border-amber-200 dark:border-amber-800'   },
  'Pending Release':   { bg: 'bg-slate-100 dark:bg-slate-700/50',    text: 'text-slate-600 dark:text-slate-300',     border: 'border-slate-200 dark:border-slate-600'   },
}

export default function TreasurerRequestsPage() {
  const supabase = createClient()
  const [requests, setRequests]           = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState('')
  const [releaseFilter, setReleaseFilter] = useState('')
  const [barangayFilter, setBarangayFilter] = useState('')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')
  const [sortBy, setSortBy]               = useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder]         = useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter]   = useState('')
  const [profile, setProfile]             = useState<any>(null)

  // Action processing state
  const [selectedRequest, setSelectedRequest]     = useState<any>(null)
  const [processingAction, setProcessingAction]   = useState(false)

  // Return modal state
  const [returnModalOpen, setReturnModalOpen]     = useState(false)
  const [returnRemarks, setReturnRemarks]         = useState('')

  // Detail Drawer state
  const [drawerRequest, setDrawerRequest]         = useState<any>(null)
  const [drawerDocs, setDrawerDocs]               = useState<any[]>([])
  const [loadingDocs, setLoadingDocs]             = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user && !profile) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    }

    let query = supabase
      .from('requests')
      .select('*, beneficiaries(*), payouts(release_date, amount_released)')
      .order('created_at', { ascending: false })

    if (statusFilter && statusFilter !== 'All') {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching requests for treasurer:', error)
    }

    setRequests(data ?? [])
    setLoading(false)
  }, [profile, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  // Open drawer with documents
  const openDetailDrawer = async (req: any) => {
    setDrawerRequest(req)
    setLoadingDocs(true)
    const { data: docs } = await supabase
      .from('request_documents')
      .select('*')
      .eq('request_id', req.id)
    setDrawerDocs(docs ?? [])
    setLoadingDocs(false)
  }

  const getDocUrl = async (path: string) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  /* ── readiness confirmation ─────────────────────────────────────── */
  const handleConfirmReadiness = async (req: any) => {
    if (!req.amount_approved || Number(req.amount_approved) <= 0) {
      alert('Cannot confirm readiness: Approved amount is missing or zero.')
      return
    }

    const benName = req.beneficiaries ? `${req.beneficiaries.first_name} ${req.beneficiaries.last_name}` : 'the beneficiary'
    if (!confirm(`Confirm readiness for release of ₱${Number(req.amount_approved).toLocaleString()} for ${benName}? This verifies fund allocation and notifies Admin.`)) {
      return
    }

    setProcessingAction(true)
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_readiness',
          requestId: req.id
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to confirm readiness')

      alert('Request verified! Status is now Ready for Release.')
      if (drawerRequest?.id === req.id) {
        setDrawerRequest({ ...drawerRequest, release_status: 'Ready for Release' })
      }
      loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setProcessingAction(false)
    }
  }



  /* ── return to admin ──────────────────────────────────────────── */
  const openReturnModal = (req: any) => {
    setSelectedRequest(req)
    setReturnRemarks('')
    setReturnModalOpen(true)
  }

  const handleReturnSubmit = async () => {
    if (!selectedRequest) return
    if (!returnRemarks.trim()) {
      alert('Remarks are required to return this request')
      return
    }

    setProcessingAction(true)
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'return_request',
          requestId: selectedRequest.id,
          remarks: returnRemarks.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to return request')

      alert('Request returned to Admin with remarks.')
      setReturnModalOpen(false)
      if (drawerRequest?.id === selectedRequest.id) {
        setDrawerRequest(null)
      }
      loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setProcessingAction(false)
    }
  }

  /* ── filter & sort ────────────────────────────────────────────── */
  const filteredRequests = requests.filter(r => {
    const rStatus = r.release_status || 'Pending Release'
    const matchesRelease  = releaseFilter ? rStatus === releaseFilter : true
    const matchesType     = typeFilter ? r.assistance_type === typeFilter : true
    const matchesBarangay = barangayFilter ? r.beneficiaries?.barangay === barangayFilter : true
    const matchesFrom     = dateFrom ? r.created_at >= dateFrom : true
    const matchesTo       = dateTo ? r.created_at <= dateTo + 'T23:59:59' : true
    const matchesSearch   = search
      ? `${r.beneficiaries?.first_name} ${r.beneficiaries?.last_name} ${r.id}`
          .toLowerCase().includes(search.toLowerCase())
      : true
    return matchesRelease && matchesType && matchesBarangay && matchesFrom && matchesTo && matchesSearch
  }).sort((a, b) => {
    if (sortBy === 'amount') {
      const valA = Number(a.amount_approved || 0)
      const valB = Number(b.amount_approved || 0)
      return sortOrder === 'asc' ? valA - valB : valB - valA
    } else {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
    }
  })

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setTypeFilter('')
    setReleaseFilter('')
    setBarangayFilter('')
    setDateFrom('')
    setDateTo('')
  }

  const hasFilter = !!(search || statusFilter || typeFilter || releaseFilter || barangayFilter || dateFrom || dateTo)

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">AICS Approved Requests Management</h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Treasurer View
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Review approved requests, verify fund liquidity, confirm readiness for release, and manage disbursements.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/requests"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <ClipboardList size={14} />
            All Requests Table
          </Link>
          <Link
            href="/treasurer"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            ← Treasurer Dashboard
          </Link>
          <Link
            href="/treasurer/funds"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
          >
            Fund Balances
          </Link>
        </div>
      </div>

      {/* ── Filter Controls ───────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search beneficiary name, ID, or DV number..."
              className="form-input pl-10 w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input text-xs"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Released">Released</option>
              <option value="Declined">Declined</option>
            </select>

            <select
              value={releaseFilter}
              onChange={(e) => setReleaseFilter(e.target.value)}
              className="form-input text-xs"
            >
              <option value="">All Release Statuses</option>
              {RELEASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-input text-xs"
            >
              <option value="">All Assistance Types</option>
              {ASSISTANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="form-input text-xs"
            >
              <option value="">All Barangays</option>
              {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <button
              onClick={() => {
                if (sortBy === 'date') {
                  setSortBy('amount')
                } else {
                  setSortBy('date')
                }
              }}
              className="btn btn-secondary text-xs flex items-center justify-center gap-1.5"
            >
              <ArrowUpDown size={13} />
              Sort: {sortBy === 'amount' ? 'Amount' : 'Date'} ({sortOrder})
            </button>
          </div>
        </div>

        {/* Date Range & Clear Filter row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--color-border)] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[var(--color-text-secondary)] font-medium flex items-center gap-1">
              <Calendar size={13} /> Date Range:
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-input text-xs py-1 px-2"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="form-input text-xs py-1 px-2"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500">
              Showing <strong>{filteredRequests.length}</strong> of <strong>{requests.length}</strong> approved requests
            </span>
            {hasFilter && (
              <button
                onClick={clearFilters}
                className="text-[var(--color-primary)] font-semibold hover:underline flex items-center gap-1"
              >
                <X size={12} /> Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Requests Table ────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Beneficiary & Ref</th>
                <th>Barangay</th>
                <th>Assistance Type</th>
                <th>Approved Amount</th>
                <th>Release Status</th>
                <th>Reference #</th>
                <th>Date Approved</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton h-5 w-full" /></td>)}</tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={32} className="text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-400 text-sm">No approved requests match your criteria</p>
                      <p className="text-xs text-slate-400">Try adjusting your filters or date range.</p>
                      {hasFilter && (
                        <button onClick={clearFilters} className="mt-2 text-xs font-semibold text-[var(--color-primary)] hover:underline">
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.map((r: any) => {
                const rStatus = r.release_status || 'Pending Release'
                const st = RELEASE_STATUS_STYLE[rStatus] || RELEASE_STATUS_STYLE['Pending Release']
                return (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td>
                      <div className="font-semibold text-[var(--color-text)]">
                        {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        REF: #{r.id.slice(0, 8).toUpperCase()}
                      </div>
                    </td>
                    <td className="text-xs text-[var(--color-text-secondary)]">
                      {r.beneficiaries?.barangay || '—'}
                    </td>
                    <td>
                      <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                        {r.assistance_type}
                      </span>
                    </td>
                    <td className="font-bold text-emerald-600 dark:text-emerald-400">
                      ₱{Number(r.amount_approved || 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}>
                        {rStatus}
                      </span>
                    </td>
                    <td className="text-xs font-mono text-[var(--color-text-secondary)]">
                      #{r.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="text-xs text-slate-500">
                      {format(new Date(r.created_at), 'MMM d, yyyy')}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => openDetailDrawer(r)}
                          title="View complete details and documents"
                          className="px-2 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                        >
                          Details
                        </button>

                        {r.status === 'Approved' && rStatus !== 'Released' && (
                          <button
                            onClick={() => handleConfirmReadiness(r)}
                            title="Confirm Readiness for Release"
                            disabled={rStatus === 'Ready for Release'}
                            className="px-2 py-1 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            {rStatus === 'Ready for Release' ? 'Ready' : 'Mark Ready'}
                          </button>
                        )}

                        {r.status === 'Approved' && rStatus === 'Released' && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20">
                            Assistance Given
                          </span>
                        )}

                        {r.status === 'Approved' && rStatus !== 'Released' && (
                          <button
                            onClick={() => openReturnModal(r)}
                            title="Return request to Admin"
                            className="px-2 py-1 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                          >
                            Return
                          </button>
                        )}

                        {r.status === 'Pending' && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20">
                            Awaiting Admin
                          </span>
                        )}

                        {r.status === 'Declined' && (
                          <span className="text-[10px] text-red-500 font-medium px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/20">
                            Declined by Admin
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Drawer Modal ───────────────────────────────────── */}
      {drawerRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[var(--color-border)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">Request & Financial Clearance Details</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">ID: #{drawerRequest.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <button onClick={() => setDrawerRequest(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              {/* Beneficiary Header */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--color-border)]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">Beneficiary Profile</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Name:</span>
                    <strong className="text-slate-900 dark:text-white">
                      {drawerRequest.beneficiaries?.last_name}, {drawerRequest.beneficiaries?.first_name} {drawerRequest.beneficiaries?.middle_name || ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Barangay:</span>
                    <strong className="text-slate-900 dark:text-white">{drawerRequest.beneficiaries?.barangay || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Contact:</span>
                    <strong className="text-slate-900 dark:text-white">{drawerRequest.beneficiaries?.contact_number || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Civil Status:</span>
                    <strong className="text-slate-900 dark:text-white">{drawerRequest.beneficiaries?.civil_status || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Sex:</span>
                    <strong className="text-slate-900 dark:text-white">{drawerRequest.beneficiaries?.sex || '—'}</strong>
                  </div>
                </div>
              </div>

              {/* Assistance Details */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--color-border)]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">Assistance & Financial Details</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Assistance Type:</span>
                    <strong className="text-blue-600 dark:text-blue-400">{drawerRequest.assistance_type}</strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Amount Requested:</span>
                    <strong className="text-slate-900 dark:text-white">₱{Number(drawerRequest.amount_requested || 0).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Amount Approved:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 text-sm">₱{Number(drawerRequest.amount_approved || 0).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Release Status:</span>
                    <strong className="text-amber-600 dark:text-amber-400">{drawerRequest.release_status || 'Pending Release'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Reference ID:</span>
                    <strong className="font-mono text-slate-900 dark:text-white">#{drawerRequest.id.slice(0, 8).toUpperCase()}</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-slate-600 dark:text-slate-400 block font-medium">Purpose / Crisis Need:</span>
                    <p className="text-slate-800 dark:text-slate-200 mt-0.5">{drawerRequest.purpose}</p>
                  </div>
                  {drawerRequest.remarks && (
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-slate-600 dark:text-slate-400 block font-medium">Admin Approval Notes:</span>
                      <p className="text-slate-800 dark:text-slate-200 mt-0.5 italic">{drawerRequest.remarks}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Attached Requirements */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">Attached Proof & Requirements</h4>
                {loadingDocs ? (
                  <div className="skeleton h-12 w-full" />
                ) : drawerDocs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No attachments uploaded for this request.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {drawerDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--color-border)] text-xs">
                        <span className="truncate font-medium text-[var(--color-text)] mr-2">{doc.file_name}</span>
                        <button
                          onClick={() => getDocUrl(doc.file_path)}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0 font-semibold"
                        >
                          <Download size={13} /> View
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-6 pt-3 border-t border-[var(--color-border)]">
              <Link
                href={`/requests/${drawerRequest.id}`}
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                Go to Dedicated Page →
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerRequest(null)}
                  className="btn btn-secondary text-xs"
                >
                  Close
                </button>
                {drawerRequest.release_status !== 'Released' && drawerRequest.release_status !== 'Ready for Release' && (
                  <button
                    type="button"
                    onClick={() => {
                      const r = drawerRequest
                      setDrawerRequest(null)
                      handleConfirmReadiness(r)
                    }}
                    className="btn btn-primary text-xs"
                  >
                    Confirm Readiness
                  </button>
                )}
                {drawerRequest.release_status === 'Released' && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    ✓ Assistance given to beneficiary
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ── Return to Admin Modal ─────────────────────────────────── */}
      {returnModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--color-border)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-lg font-bold text-red-600">Return Request to Admin</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Beneficiary: {selectedRequest.beneficiaries?.first_name} {selectedRequest.beneficiaries?.last_name}
                </p>
              </div>
              <button onClick={() => setReturnModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Please state the reason for returning this request (e.g., insufficient fund balance, missing supporting receipt, amount mismatch). The Admin will be notified immediately.
              </p>
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Remarks / Reason *
                </label>
                <textarea
                  className="form-input w-full h-24 text-xs"
                  placeholder="State the reason for return..."
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturnSubmit}
                disabled={processingAction || !returnRemarks.trim()}
                className="btn btn-danger text-sm flex items-center gap-1.5"
              >
                <RotateCcw size={15} />
                {processingAction ? 'Returning...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
