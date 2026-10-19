'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ASSISTANCE_TYPES, BARANGAYS } from '@/lib/constants'
import {
  Search, FileText, CheckCircle, AlertCircle, Clock, RotateCcw,
  Filter, Download, ChevronRight, X, ArrowUpDown, Banknote,
  Calendar, Eye, XCircle, CheckCircle2, User, Phone, MapPin, Building,
  ClipboardList, ExternalLink, RefreshCw, Copy, Check, ArrowRight,
  ShieldCheck, HelpCircle, Info, Receipt, ChevronDown,
  ZoomIn, ZoomOut, RotateCw, Loader2
} from 'lucide-react'
import { format } from 'date-fns'

const RELEASE_STATUS_STYLE: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  'Released': {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    label: 'Released (Disbursed)'
  },
  'Ready for Release': {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    label: 'Ready for Release'
  },
  'Pending Release': {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    label: 'Pending Release'
  },
}

type TabType = 'pending' | 'ready' | 'released' | 'history'

function UnifiedTreasurerReleaseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Determine active tab from URL query params
  const rawStatusParam = searchParams.get('release_status') || searchParams.get('tab') || ''
  const activeTab: TabType = useMemo(() => {
    if (rawStatusParam === 'Pending Release' || rawStatusParam === 'pending') return 'pending'
    if (rawStatusParam === 'Ready for Release' || rawStatusParam === 'ready') return 'ready'
    if (rawStatusParam === 'Released' || rawStatusParam === 'released') return 'released'
    return 'history'
  }, [rawStatusParam])

  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusDropdownFilter, setStatusDropdownFilter] = useState('')
  const [barangayFilter, setBarangayFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [profile, setProfile] = useState<any>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Lifecycle bar collapse/expand state (default visible as in user screenshot)
  const [showLifecycleGuide, setShowLifecycleGuide] = useState(true)

  // Action processing state
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [processingAction, setProcessingAction] = useState(false)

  // Return to Admin modal state
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [returnRemarks, setReturnRemarks] = useState('')

  // Detail Drawer state
  const [drawerRequest, setDrawerRequest] = useState<any>(null)
  const [drawerDocs, setDrawerDocs] = useState<any[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  // Document Preview Lightbox state
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState<boolean>(false)
  const [previewError, setPreviewError] = useState<string>('')
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [rotation, setRotation] = useState<number>(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user && !profile) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    }

    // Load all approved & released requests relevant to Treasury
    const { data, error } = await supabase
      .from('requests')
      .select('*, beneficiaries(*), payouts(release_date, amount_released, acknowledgment_notes)')
      .in('status', ['Approved', 'Released'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching requests for treasury release management:', error)
    }

    setRequests(data ?? [])
    setLoading(false)
  }, [profile])

  useEffect(() => { loadData() }, [loadData])

  // Real-time synchronization on requests table updates
  useEffect(() => {
    const channel = supabase
      .channel('treasury_unified_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData])

  // Tab switching handler that synchronizes the URL
  const handleTabChange = (tab: TabType) => {
    if (tab === 'pending') {
      router.push('/treasurer/requests?release_status=Pending+Release')
    } else if (tab === 'ready') {
      router.push('/treasurer/requests?release_status=Ready+for+Release')
    } else if (tab === 'released') {
      router.push('/treasurer/requests?release_status=Released')
    } else {
      router.push('/treasurer/requests')
    }
  }

  // Calculate live counts and total amounts across all 4 stages
  const stats = useMemo(() => {
    let pendingCount = 0
    let pendingAmount = 0
    let readyCount = 0
    let readyAmount = 0
    let releasedCount = 0
    let releasedAmount = 0

    requests.forEach(r => {
      const rStatus = r.release_status || 'Pending Release'
      const amount = Number(r.amount_approved || 0)

      if (r.status === 'Released' || rStatus === 'Released') {
        releasedCount++
        releasedAmount += amount
      } else if (rStatus === 'Ready for Release') {
        readyCount++
        readyAmount += amount
      } else {
        pendingCount++
        pendingAmount += amount
      }
    })

    return {
      pendingCount,
      pendingAmount,
      readyCount,
      readyAmount,
      releasedCount,
      releasedAmount,
      totalCount: requests.length,
      totalAmount: pendingAmount + readyAmount + releasedAmount,
    }
  }, [requests])

  // Filter requests based on active tab / filter dropdown / search / barangay / date
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const rStatus = r.release_status || 'Pending Release'
      const isReleased = r.status === 'Released' || rStatus === 'Released'
      const isReady = rStatus === 'Ready for Release' && !isReleased
      const isPending = !isReleased && !isReady

      // 1. Primary filter: Active sub-tab
      if (activeTab === 'pending' && !isPending) return false
      if (activeTab === 'ready' && !isReady) return false
      if (activeTab === 'released' && !isReleased) return false

      // 2. Secondary Status Dropdown filter (especially active in Request History or for sub-filtering)
      if (statusDropdownFilter) {
        if (statusDropdownFilter === 'Pending Release' && !isPending) return false
        if (statusDropdownFilter === 'Ready for Release' && !isReady) return false
        if (statusDropdownFilter === 'Released' && !isReleased) return false
      }

      // 3. Category & Barangay filters
      if (typeFilter && r.assistance_type !== typeFilter) return false
      if (barangayFilter && r.beneficiaries?.barangay !== barangayFilter) return false

      // 4. Date Range
      if (dateFrom && r.created_at < dateFrom) return false
      if (dateTo && r.created_at > dateTo + 'T23:59:59') return false

      // 5. Search query (Beneficiary Name, Reference ID, Barangay, Contact)
      if (search) {
        const query = search.toLowerCase()
        const fullName = `${r.beneficiaries?.first_name || ''} ${r.beneficiaries?.last_name || ''}`.toLowerCase()
        const refId = (r.id || '').toLowerCase()
        const brgy = (r.beneficiaries?.barangay || '').toLowerCase()
        const contact = (r.beneficiaries?.contact_number || '').toLowerCase()
        if (!fullName.includes(query) && !refId.includes(query) && !brgy.includes(query) && !contact.includes(query)) {
          return false
        }
      }

      return true
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
  }, [requests, activeTab, statusDropdownFilter, typeFilter, barangayFilter, dateFrom, dateTo, search, sortBy, sortOrder])

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('')
    setStatusDropdownFilter('')
    setBarangayFilter('')
    setDateFrom('')
    setDateTo('')
  }

  const hasFilter = !!(search || typeFilter || statusDropdownFilter || barangayFilter || dateFrom || dateTo)

  const copyRefId = (id: string) => {
    const short = id.slice(0, 8).toUpperCase()
    navigator.clipboard.writeText(short)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1800)
  }

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

  const handlePreviewDoc = async (doc: any) => {
    setPreviewDoc(doc)
    setPreviewLoading(true)
    setPreviewError('')
    setZoomLevel(1)
    setRotation(0)

    try {
      const res = await fetch('/api/documents/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: doc.file_path,
          userId: profile?.id
        })
      })

      const data = await res.json()
      if (!res.ok || !data.signedUrl) {
        throw new Error(data.error || 'File not found or unavailable in storage')
      }

      setPreviewUrl(data.signedUrl)
    } catch (err: any) {
      console.error('Error fetching document preview:', err)
      setPreviewError(err.message || 'File not found or unavailable')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDownloadDoc = async (doc: any, customUrl?: string) => {
    try {
      let downloadUrl = customUrl || previewUrl
      if (!downloadUrl) {
        const res = await fetch('/api/documents/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: doc.file_path,
            userId: profile?.id
          })
        })
        const data = await res.json()
        if (res.ok && data.signedUrl) {
          downloadUrl = data.signedUrl
        }
      }

      if (!downloadUrl) {
        alert('Could not download file: Storage URL is unavailable.')
        return
      }

      const response = await fetch(downloadUrl)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = doc.file_name || 'attachment'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(blobUrl)
      document.body.removeChild(a)
    } catch (err: any) {
      console.error('Download error:', err)
      if (customUrl || previewUrl) window.open(customUrl || previewUrl, '_blank')
    }
  }

  const closePreview = () => {
    setPreviewDoc(null)
    setPreviewUrl('')
    setPreviewError('')
    setZoomLevel(1)
    setRotation(0)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewDoc) {
        closePreview()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewDoc])

  /* ── Confirm Readiness for Release ────────────────────────── */
  const handleConfirmReadiness = async (req: any) => {
    if (!req.amount_approved || Number(req.amount_approved) <= 0) {
      alert('Cannot confirm readiness: Approved amount is missing or zero.')
      return
    }

    const benName = req.beneficiaries ? `${req.beneficiaries.first_name} ${req.beneficiaries.last_name}` : 'the beneficiary'
    if (!confirm(`Confirm readiness for release of ₱${Number(req.amount_approved).toLocaleString()} for ${benName}?\n\nThis verifies fund allocation and advances the request to "Ready for Release".`)) {
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

      alert('Fund readiness confirmed! Request moved to "Ready for Release".')
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

  /* ── Return to Admin ──────────────────────────────────────── */
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
          reason: returnRemarks.trim()
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

  // Active tab helper context
  const activeHelperNotice = {
    pending: {
      label: 'Pending Release',
      color: 'text-amber-700 dark:text-amber-300',
      text: 'Review fund liquidity for these requests. Once verified, click "Verify & Mark Ready" to allocate budget for disbursement. If funds or documents are lacking, click "Return to Admin".'
    },
    ready: {
      label: 'Ready for Release',
      color: 'text-blue-700 dark:text-blue-300',
      text: 'Funds are verified and earmarked. Cash or voucher is prepared. Record payout when assistance is officially distributed to the beneficiary.'
    },
    released: {
      label: 'Released Requests',
      color: 'text-emerald-700 dark:text-emerald-300',
      text: 'Completed assistance disbursements with logged release dates and disbursement vouchers in the treasury ledger.'
    },
    history: {
      label: 'Request History',
      color: 'text-indigo-700 dark:text-indigo-300',
      text: 'Complete master ledger of all AICS assistance requests across all lifecycle stages. Use filters below to search any record.'
    }
  }[activeTab]

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb & Page Header ───────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] mb-1">
            <Link href="/treasurer" className="hover:underline">Treasurer</Link>
            <span>/</span>
            <span className="text-[var(--color-text)] font-semibold">Release Management</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">
              Release Management
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Treasury Module
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Unified disbursement management: verify fund allocations, prepare releases, and track completed beneficiary payouts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!showLifecycleGuide && (
            <button
              id="show-lifecycle-guide-btn"
              onClick={() => setShowLifecycleGuide(true)}
              className="cursor-pointer px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Info size={14} className="text-blue-500" />
              Show Lifecycle Guide
            </button>
          )}
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="cursor-pointer px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            title="Refresh requests list"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link
            href="/treasurer"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            ← Dashboard
          </Link>
          <Link
            href="/treasurer/funds"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
          >
            <Banknote size={14} />
            Fund Balances
          </Link>
        </div>
      </div>

      {/* ── 1. Interactive Treasury Lifecycle Guide Bar ────────────── */}
      {showLifecycleGuide && (
        <div className="card p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50/70 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-slate-900/40 border-blue-200 dark:border-blue-900/50 animate-fade-in shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                Treasury Lifecycle: How Requests Flow to Release
              </h3>
            </div>
            <button
              id="close-lifecycle-guide-btn"
              onClick={() => setShowLifecycleGuide(false)}
              className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800 transition-colors"
              title="Close guide (can be reopened via 'Show Lifecycle Guide')"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* Step 1: Admin Approval */}
            <button
              type="button"
              onClick={() => handleTabChange('history')}
              className={`p-3 rounded-xl text-left transition-all border ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-400/30 shadow-xs'
                  : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-extrabold">1</span>
                  Admin Approval
                </div>
                {activeTab === 'history' && <span className="text-[10px] font-bold text-indigo-600">Active</span>}
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Social Worker / Admin reviews beneficiary eligibility and approves the request with an assistance amount.
              </p>
            </button>

            {/* Step 2: Pending Release */}
            <button
              type="button"
              onClick={() => handleTabChange('pending')}
              className={`p-3 rounded-xl text-left transition-all border ${
                activeTab === 'pending'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/40 shadow-xs'
                  : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 flex items-center justify-center text-[10px] font-extrabold">2</span>
                  Pending Release
                </div>
                {activeTab === 'pending' && <span className="text-[10px] font-bold text-amber-700">Active</span>}
              </div>
              <p className="text-amber-700/90 dark:text-amber-300/80 text-[11px] leading-relaxed">
                Treasurer verifies fund liquidity. Click <strong>"Verify & Mark Ready"</strong> to allocate funds, or Return to Admin if issues exist.
              </p>
            </button>

            {/* Step 3: Ready for Release */}
            <button
              type="button"
              onClick={() => handleTabChange('ready')}
              className={`p-3 rounded-xl text-left transition-all border ${
                activeTab === 'ready'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400/40 shadow-xs'
                  : 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
                  <span className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 flex items-center justify-center text-[10px] font-extrabold">3</span>
                  Ready for Release
                </div>
                {activeTab === 'ready' && <span className="text-[10px] font-bold text-blue-700">Active</span>}
              </div>
              <p className="text-blue-700/90 dark:text-blue-300/80 text-[11px] leading-relaxed">
                Funds are verified and earmarked. Cash or voucher is prepared for distribution to the beneficiary.
              </p>
            </button>

            {/* Step 4: Released */}
            <button
              type="button"
              onClick={() => handleTabChange('released')}
              className={`p-3 rounded-xl text-left transition-all border ${
                activeTab === 'released'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/40 shadow-xs'
                  : 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-center justify-center text-[10px] font-extrabold">4</span>
                  Released
                </div>
                {activeTab === 'released' && <span className="text-[10px] font-bold text-emerald-700">Active</span>}
              </div>
              <p className="text-emerald-700/90 dark:text-emerald-300/80 text-[11px] leading-relaxed">
                Assistance officially given to the beneficiary. Payout record and receipt are logged in the historical ledger.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* ── 2. Interactive KPI Stat Cards (With Real Counts & Amounts) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* PENDING RELEASE CARD (Orange / Amber) */}
        <button
          onClick={() => handleTabChange('pending')}
          className={`p-4 rounded-2xl text-left transition-all border cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 shadow-md shadow-amber-500/15 ring-2 ring-amber-400/50'
              : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-amber-300 dark:hover:border-amber-700/50 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">PENDING RELEASE</span>
            <Clock size={16} />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text)]">
            {stats.pendingCount}
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mt-1">
            <span>Awaiting Verification</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">₱{stats.pendingAmount.toLocaleString()}</span>
          </div>
        </button>

        {/* READY FOR RELEASE CARD (Blue) */}
        <button
          onClick={() => handleTabChange('ready')}
          className={`p-4 rounded-2xl text-left transition-all border cursor-pointer ${
            activeTab === 'ready'
              ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500 shadow-md shadow-blue-500/15 ring-2 ring-blue-400/50'
              : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-blue-300 dark:hover:border-blue-700/50 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">READY FOR RELEASE</span>
            <Banknote size={16} />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text)]">
            {stats.readyCount}
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mt-1">
            <span>Funds Earmarked</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">₱{stats.readyAmount.toLocaleString()}</span>
          </div>
        </button>

        {/* RELEASED REQUESTS CARD (Green) */}
        <button
          onClick={() => handleTabChange('released')}
          className={`p-4 rounded-2xl text-left transition-all border cursor-pointer ${
            activeTab === 'released'
              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-500 shadow-md shadow-emerald-500/15 ring-2 ring-emerald-400/50'
              : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">RELEASED REQUESTS</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text)]">
            {stats.releasedCount}
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mt-1">
            <span>Disbursed Assistance</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">₱{stats.releasedAmount.toLocaleString()}</span>
          </div>
        </button>

        {/* REQUEST HISTORY CARD (Indigo / Purple) */}
        <button
          onClick={() => handleTabChange('history')}
          className={`p-4 rounded-2xl text-left transition-all border cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500 shadow-md shadow-indigo-500/15 ring-2 ring-indigo-400/50'
              : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-indigo-300 dark:hover:border-indigo-700/50 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">REQUEST HISTORY</span>
            <ClipboardList size={16} />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text)]">
            {stats.totalCount}
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mt-1">
            <span>All Treasury Records</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">₱{stats.totalAmount.toLocaleString()}</span>
          </div>
        </button>
      </div>

      {/* ── 3. Unified Sub-Tab Row (Status Groups) ─────────────────── */}
      <div className="border-b border-[var(--color-border)] flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {/* Pending Release Chip (Orange) */}
        <button
          onClick={() => handleTabChange('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-1 ring-amber-600'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
          }`}
        >
          <Clock size={15} />
          Pending Release
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeTab === 'pending' ? 'bg-white/25 text-white' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
          }`}>
            {stats.pendingCount}
          </span>
        </button>

        {/* Ready for Release Chip (Blue) */}
        <button
          onClick={() => handleTabChange('ready')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'ready'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-700'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
          }`}
        >
          <Banknote size={15} />
          Ready for Release
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeTab === 'ready' ? 'bg-white/25 text-white' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
          }`}>
            {stats.readyCount}
          </span>
        </button>

        {/* Released Requests Chip (Green) */}
        <button
          onClick={() => handleTabChange('released')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'released'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-700'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
          }`}
        >
          <CheckCircle2 size={15} />
          Released Requests
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeTab === 'released' ? 'bg-white/25 text-white' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
          }`}>
            {stats.releasedCount}
          </span>
        </button>

        {/* Request History Chip (Indigo / Purple) */}
        <button
          onClick={() => handleTabChange('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-700'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
          }`}
        >
          <ClipboardList size={15} />
          Request History (All)
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeTab === 'history' ? 'bg-white/25 text-white' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
          }`}>
            {stats.totalCount}
          </span>
        </button>
      </div>

      {/* ── Contextual helper prompt ──────────────────────────────── */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex items-start gap-2 shadow-2xs">
        <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
        <div>
          <strong className={`font-semibold mr-1.5 ${activeHelperNotice.color}`}>
            {activeHelperNotice.label}:
          </strong>
          {activeHelperNotice.text}
        </div>
      </div>

      {/* ── 4. Search & Filter Bar ─────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search by Beneficiary Name or Reference */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search beneficiary name, reference ID, contact #, or barangay..."
              className="form-input pl-10 w-full"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-wrap">
            {/* Assistance Type Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-input text-xs"
            >
              <option value="">All Assistance Types</option>
              {ASSISTANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Barangay Dropdown */}
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="form-input text-xs"
            >
              <option value="">All Barangays</option>
              {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            {/* Status Dropdown */}
            <select
              value={statusDropdownFilter}
              onChange={(e) => setStatusDropdownFilter(e.target.value)}
              className="form-input text-xs"
            >
              <option value="">All Statuses</option>
              <option value="Pending Release">Pending Release (Awaiting Verification)</option>
              <option value="Ready for Release">Ready for Release (Funds Earmarked)</option>
              <option value="Released">Released (Disbursed)</option>
            </select>

            {/* Sort Toggle (Date / Amount) */}
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

        {/* Date Range & Summary Count */}
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
              Showing <strong>{filteredRequests.length}</strong> of <strong>{requests.length}</strong> records
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

      {/* ── 5. Combined Unified Request Table ──────────────────────── */}
      <div className="card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Beneficiary</th>
                <th>Reference #</th>
                <th>Barangay</th>
                <th>Assistance Type</th>
                <th>Approved Amount</th>
                <th>Release Status</th>
                <th>Date</th>
                <th className="text-right">Available Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j}><div className="skeleton h-5 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 max-w-md mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-1">
                        <FileText size={24} />
                      </div>
                      <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                        No requests match your current filters
                      </p>
                      <p className="text-xs text-slate-500 text-center leading-relaxed">
                        Try resetting your search filters, changing the selected sub-tab, or adjusting your date range.
                      </p>
                      {hasFilter && (
                        <button
                          onClick={clearFilters}
                          className="mt-2 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                        >
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r: any) => {
                  const rStatus = r.release_status || 'Pending Release'
                  const isReleased = r.status === 'Released' || rStatus === 'Released'
                  const isReady = rStatus === 'Ready for Release' && !isReleased
                  const isPending = !isReleased && !isReady

                  const st = isReleased
                    ? RELEASE_STATUS_STYLE['Released']
                    : (RELEASE_STATUS_STYLE[rStatus] || RELEASE_STATUS_STYLE['Pending Release'])
                  const shortRef = r.id.slice(0, 8).toUpperCase()

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Beneficiary */}
                      <td>
                        <div className="font-semibold text-[var(--color-text)]">
                          {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          {r.beneficiaries?.contact_number ? (
                            <span>{r.beneficiaries.contact_number}</span>
                          ) : (
                            <span className="italic">No contact #</span>
                          )}
                        </div>
                      </td>

                      {/* Reference / Ticket # */}
                      <td>
                        <button
                          onClick={() => copyRefId(r.id)}
                          className="group inline-flex items-center gap-1 font-mono text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded transition-colors"
                          title="Click to copy full reference ID"
                        >
                          #{shortRef}
                          {copiedId === r.id ? (
                            <Check size={11} className="text-emerald-500" />
                          ) : (
                            <Copy size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </td>

                      {/* Barangay */}
                      <td className="text-xs text-[var(--color-text-secondary)]">
                        {r.beneficiaries?.barangay || '—'}
                      </td>

                      {/* Assistance Type */}
                      <td>
                        <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                          {r.assistance_type}
                        </span>
                      </td>

                      {/* Approved Amount */}
                      <td className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ₱{Number(r.amount_approved || 0).toLocaleString()}
                      </td>

                      {/* Release Status Badge */}
                      <td>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {isReleased ? 'Released' : rStatus}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="text-xs text-slate-500">
                        {isReleased && r.payouts?.[0]?.release_date ? (
                          <div>
                            <span className="font-medium text-emerald-700 dark:text-emerald-400 block">
                              {format(new Date(r.payouts[0].release_date), 'MMM d, yyyy')}
                            </span>
                            <span className="text-[10px] text-slate-400">Disbursed</span>
                          </div>
                        ) : (
                          <div>
                            <span className="block">{format(new Date(r.created_at), 'MMM d, yyyy')}</span>
                            <span className="text-[10px] text-slate-400">Approved</span>
                          </div>
                        )}
                      </td>

                      {/* Available Actions per Status */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Details / View Record */}
                          <button
                            onClick={() => openDetailDrawer(r)}
                            title="View financial clearance & attachments"
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          >
                            Details
                          </button>

                          {/* PENDING RELEASE: Verify & Mark Ready OR Return to Admin */}
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleConfirmReadiness(r)}
                                disabled={processingAction}
                                title="Confirm liquidity and mark as Ready for Release"
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-2xs"
                              >
                                <Check size={12} />
                                Verify & Mark Ready
                              </button>
                              <button
                                onClick={() => openReturnModal(r)}
                                disabled={processingAction}
                                title="Return request to Admin for corrections"
                                className="px-2 py-1 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                              >
                                Return
                              </button>
                            </>
                          )}

                          {/* READY FOR RELEASE: Prepare voucher / Release funds action */}
                          {isReady && (
                            <Link
                              href={`/payouts/new?request_id=${r.id}`}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-2xs"
                              title="Prepare voucher / record payout disbursement"
                            >
                              <Banknote size={12} />
                              Release Funds
                            </Link>
                          )}

                          {/* RELEASED REQUESTS: View payout record & ledger log */}
                          {isReleased && (
                            <button
                              onClick={() => openDetailDrawer(r)}
                              className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 flex items-center gap-1"
                              title="View disbursement receipt & voucher log"
                            >
                              <Receipt size={11} />
                              Payout Record
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
      </div>

      {/* ── Detail Drawer Modal ───────────────────────────────────── */}
      {drawerRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[var(--color-border)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">Financial Clearance & Record Details</h3>
                <p className="text-xs text-[var(--color-text-secondary)] font-mono">
                  REF: #{drawerRequest.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <button onClick={() => setDrawerRequest(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              {/* Lifecycle Progress Bar in Drawer */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--color-border)]">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Request Release Stage
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 size={14} /> 1. Admin Approved
                  </div>
                  <ArrowRight size={12} className="text-slate-400" />
                  <div className={`flex items-center gap-1.5 font-semibold ${
                    drawerRequest.release_status === 'Ready for Release' || drawerRequest.status === 'Released'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {drawerRequest.release_status === 'Ready for Release' || drawerRequest.status === 'Released' ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Clock size={14} />
                    )}
                    2. Fund Verification
                  </div>
                  <ArrowRight size={12} className="text-slate-400" />
                  <div className={`flex items-center gap-1.5 font-semibold ${
                    drawerRequest.status === 'Released' || drawerRequest.release_status === 'Released'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400'
                  }`}>
                    {drawerRequest.status === 'Released' || drawerRequest.release_status === 'Released' ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Banknote size={14} />
                    )}
                    3. Disbursement
                  </div>
                </div>
              </div>

              {/* Beneficiary Profile */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--color-border)]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  Beneficiary Profile
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block font-medium">Name:</span>
                    <strong className="text-slate-900 dark:text-white">
                      {drawerRequest.beneficiaries?.last_name}, {drawerRequest.beneficiaries?.first_name} {drawerRequest.beneficiaries?.middle_name || ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Barangay:</span>
                    <strong className="text-slate-900 dark:text-white">{drawerRequest.beneficiaries?.barangay || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Contact:</span>
                    <strong className="text-slate-900 dark:text-white">{drawerRequest.beneficiaries?.contact_number || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Civil Status:</span>
                    <strong className="text-slate-900 dark:text-white">{drawerRequest.beneficiaries?.civil_status || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Sex:</span>
                    <strong className="text-slate-900 dark:text-white">{drawerRequest.beneficiaries?.sex || '—'}</strong>
                  </div>
                </div>
              </div>

              {/* Financial & Assistance Details */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--color-border)]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  Financial & Assistance Allocation
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block font-medium">Assistance Type:</span>
                    <strong className="text-blue-600 dark:text-blue-400">{drawerRequest.assistance_type}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Amount Requested:</span>
                    <strong className="text-slate-900 dark:text-white">₱{Number(drawerRequest.amount_requested || 0).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Amount Approved:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 text-sm">₱{Number(drawerRequest.amount_approved || 0).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Release Status:</span>
                    <strong className="text-amber-600 dark:text-amber-400">{drawerRequest.release_status || 'Pending Release'}</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-slate-500 block font-medium">Crisis Need / Purpose:</span>
                    <p className="text-slate-800 dark:text-slate-200 mt-0.5">{drawerRequest.purpose}</p>
                  </div>
                  {drawerRequest.remarks && (
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-slate-500 block font-medium">Admin Approval Remarks:</span>
                      <p className="text-slate-800 dark:text-slate-200 mt-0.5 italic">{drawerRequest.remarks}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payout & Ledger Record if Released */}
              {drawerRequest.payouts && drawerRequest.payouts.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
                    <Receipt size={14} /> Official Payout Record
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block font-medium">Release Date:</span>
                      <strong className="text-emerald-700 dark:text-emerald-300 font-semibold">
                        {format(new Date(drawerRequest.payouts[0].release_date), 'MMMM d, yyyy')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">Amount Disbursed:</span>
                      <strong className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                        ₱{Number(drawerRequest.payouts[0].amount_released || drawerRequest.amount_approved || 0).toLocaleString()}
                      </strong>
                    </div>
                    {drawerRequest.payouts[0].acknowledgment_notes && (
                      <div className="col-span-2">
                        <span className="text-slate-500 block font-medium">Disbursement Notes:</span>
                        <p className="text-slate-800 dark:text-slate-200 mt-0.5 italic">{drawerRequest.payouts[0].acknowledgment_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Attached Documents */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  Attached Requirements & Proof
                </h4>
                {loadingDocs ? (
                  <div className="skeleton h-12 w-full" />
                ) : drawerDocs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No attachments uploaded for this request.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {drawerDocs.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--color-border)] bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all text-xs"
                      >
                        <span className="truncate font-medium text-[var(--color-text)] mr-2" title={doc.file_name}>
                          {doc.file_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePreviewDoc(doc)}
                          className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1.5 shrink-0 font-semibold px-2.5 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          title="Preview and download attachment"
                        >
                          <Download size={13} />
                          <span>View</span>
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
                View Full Request Record →
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
                {drawerRequest.release_status === 'Ready for Release' && (
                  <Link
                    href={`/payouts/new?request_id=${drawerRequest.id}`}
                    className="btn btn-primary text-xs"
                  >
                    Release Funds
                  </Link>
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
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                State the reason for returning this request (e.g. insufficient assistance fund balance, missing medical certificate, amount mismatch). The Admin will be notified immediately.
              </p>
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Reason for Return *
                </label>
                <textarea
                  className="form-input w-full h-24 text-xs"
                  placeholder="State the reason clearly..."
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
      {/* ── Document Preview Lightbox Modal ──────────────────────── */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePreview()
          }}
          id="document-preview-modal"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)] bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5 min-w-0 mr-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[var(--color-text)] truncate" title={previewDoc.file_name}>
                    {previewDoc.file_name}
                  </h3>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    Attached Requirement / Proof Document
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Zoom Controls */}
                {previewUrl && !previewError && !previewLoading && (
                  <div className="hidden sm:flex items-center gap-1 mr-2 px-1.5 py-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                      className="p-1 rounded hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(1)}
                      className="px-1.5 py-0.5 rounded hover:bg-white dark:hover:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      title="Reset Zoom"
                    >
                      {Math.round(zoomLevel * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                      className="p-1 rounded hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="p-1 rounded hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer ml-1"
                      title="Rotate 90 degrees"
                    >
                      <RotateCw size={14} />
                    </button>
                  </div>
                )}

                {/* Download Button */}
                {previewUrl && !previewError && (
                  <button
                    type="button"
                    onClick={() => handleDownloadDoc(previewDoc, previewUrl)}
                    className="cursor-pointer px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-2xs"
                    title="Download original file"
                    id="preview-download-btn"
                  >
                    <Download size={13} />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                )}

                {/* Close Button */}
                <button
                  type="button"
                  onClick={closePreview}
                  className="cursor-pointer p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
                  title="Close preview (Esc)"
                  id="preview-close-btn"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Image Area */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-950/5 dark:bg-black/30 min-h-[360px] max-h-[72vh]">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                  <Loader2 size={32} className="animate-spin text-blue-600" />
                  <p className="text-xs font-medium">Retrieving attachment from secure storage...</p>
                </div>
              ) : previewError ? (
                <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 max-w-md text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-red-800 dark:text-red-200">Unable to Load Attachment</h4>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{previewError}</p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreviewDoc(previewDoc)}
                      className="btn btn-secondary text-xs"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={closePreview}
                      className="btn btn-primary text-xs"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="relative max-w-full max-h-full flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={previewDoc.file_name}
                    className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-lg transition-transform duration-200 select-none"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center'
                    }}
                    onError={() => setPreviewError('File not found or unavailable')}
                  />
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-2.5 border-t border-[var(--color-border)] bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span className="truncate mr-4">
                File: <strong className="text-[var(--color-text)]">{previewDoc.file_name}</strong>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline">Use zoom buttons to inspect document</span>
                <button
                  type="button"
                  onClick={closePreview}
                  className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300 hover:underline"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TreasurerRequestsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
        <div className="skeleton h-64" />
      </div>
    }>
      <UnifiedTreasurerReleaseContent />
    </Suspense>
  )
}
