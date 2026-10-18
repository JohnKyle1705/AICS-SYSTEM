'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Request } from '@/types'
import { ASSISTANCE_TYPES } from '@/lib/constants'
import {
  Search, FileText, CheckCircle2, AlertCircle, Briefcase,
  ArrowDownRight, PieChart, BookOpen, CreditCard, X, Info,
  TrendingUp, Filter, RotateCcw, Send, CheckCircle, BarChart2,
  ScrollText, Wallet, Clock, ArrowUpRight, Plus, RefreshCw, XCircle,
  ClipboardList, ChevronRight
} from 'lucide-react'
import { format } from 'date-fns'
import { useLanguage } from '@/lib/LanguageContext'

/* ─── constants ──────────────────────────────────────────────────── */
const RELEASE_STATUSES = ['Pending Release', 'Ready for Release', 'Released']

const RELEASE_STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  'Released':          { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  'Ready for Release': { bg: 'bg-amber-100 dark:bg-amber-900/30',    text: 'text-amber-700 dark:text-amber-400',     border: 'border-amber-200 dark:border-amber-800'   },
  'Pending Release':   { bg: 'bg-slate-100 dark:bg-slate-700/50',    text: 'text-slate-600 dark:text-slate-300',     border: 'border-slate-200 dark:border-slate-600'   },
}

/* ─── types ──────────────────────────────────────────────────────── */
type ActiveCard = 'total_funds' | 'total_allocated' | 'released' | 'available' | 'pending' | 'approved' | null
type ActiveFund = string | null

export default function TreasurerDashboardPage() {
  const [requests, setRequests]           = useState<any[]>([])
  const [funds, setFunds]                 = useState<any[]>([])
  const [transactions, setTransactions]   = useState<any[]>([])
  const [search, setSearch]               = useState('')
  const [type, setType]                   = useState('')
  const [releaseFilter, setReleaseFilter] = useState('')
  const [loading, setLoading]             = useState(true)
  const [profile, setProfile]             = useState<any>(null)
  const [pendingCount, setPendingCount]   = useState(0)
  const [totalRequestsCount, setTotalRequestsCount] = useState(0)

  const [activeCard, setActiveCard]       = useState<ActiveCard>(null)
  const [activeFund, setActiveFund]       = useState<ActiveFund>(null)
  const [showTooltip, setShowTooltip]     = useState(false)
  const tooltipRef                        = useRef<HTMLDivElement>(null)

  // Voucher modal state
  const [voucherModalOpen, setVoucherModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest]   = useState<any>(null)
  const [voucherNo, setVoucherNo]               = useState('')
  const [checkNo, setCheckNo]                   = useState('')
  const [paymentMethod, setPaymentMethod]       = useState('Cash')
  const [disbursingOfficer, setDisbursingOfficer] = useState('')
  const [voucherNotes, setVoucherNotes]         = useState('')
  const [processingAction, setProcessingAction] = useState(false)

  // Return to Admin modal state
  const [returnModalOpen, setReturnModalOpen]   = useState(false)
  const [returnRemarks, setReturnRemarks]       = useState('')

  const supabase = createClient()
  const { t }    = useLanguage()

  /* ── data loading ─────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user && !profile) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      if (p?.full_name) setDisbursingOfficer(p.full_name)
    }

    // Fetch approved requests
    const { data: reqData } = await supabase
      .from('requests')
      .select('*, beneficiaries(first_name, last_name, barangay, contact_number)')
      .eq('status', 'Approved')
      .order('created_at', { ascending: false })
    setRequests(reqData ?? [])

    // Fetch funds
    const { data: fundsData } = await supabase.from('funds').select('*').order('assistance_type')
    setFunds(fundsData ?? [])

    // Accurate pending count
    const { count } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Approved')
      .or('release_status.is.null,release_status.neq.Released')
    setPendingCount(count ?? 0)

    // Total requests across all statuses for financial monitoring
    const { count: totalReqs } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
    setTotalRequestsCount(totalReqs ?? 0)

    // Recent fund transactions
    const { data: txData } = await supabase
      .from('fund_transactions')
      .select('*, funds(assistance_type), profiles(full_name), requests(id, beneficiaries(first_name, last_name))')
      .order('created_at', { ascending: false })
      .limit(6)
    setTransactions(txData ?? [])

    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const channel = supabase
      .channel('treasurer_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'funds' }, () => {
        load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_transactions' }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ── financial calculations ───────────────────────────────────── */
  const totalFundsBudget = funds.reduce((s, f) => s + Number(f.total_allocated || 0), 0)
  const totalAvailable   = funds.reduce((s, f) => s + Number(f.current_balance || 0), 0)
  const totalReleased    = funds.reduce((s, f) => s + Number(f.total_released || 0), 0)

  // Total allocated earmarked for pending/ready release requests
  const totalEarmarkedAllocated = requests
    .filter(r => (r.release_status || 'Pending Release') !== 'Released')
    .reduce((s, r) => s + Number(r.amount_approved || 0), 0)

  const formatPHP = (val: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val)

  /* ── card click handlers ──────────────────────────────────────── */
  const handleCardClick = (card: ActiveCard) => {
    if (activeCard === card) {
      setActiveCard(null)
      setReleaseFilter('')
    } else {
      setActiveCard(card)
      setActiveFund(null)
      setType('')

      if (card === 'total_funds') {
        setReleaseFilter('')
        document.getElementById('fund-balances-section')?.scrollIntoView({ behavior: 'smooth' })
      } else if (card === 'total_allocated') {
        setReleaseFilter('Pending Release')
      } else if (card === 'released') {
        setReleaseFilter('Released')
      } else if (card === 'available') {
        setReleaseFilter('')
        setShowTooltip(true)
      } else if (card === 'pending') {
        setReleaseFilter('Pending Release')
      } else if (card === 'approved') {
        setReleaseFilter('')
      }
    }
  }

  const handleFundClick = (fundType: string) => {
    if (activeFund === fundType) {
      setActiveFund(null)
      setType('')
    } else {
      setActiveFund(fundType)
      setActiveCard(null)
      setType(fundType)
    }
  }

  const clearAll = () => {
    setActiveCard(null)
    setActiveFund(null)
    setReleaseFilter('')
    setType('')
    setSearch('')
    setShowTooltip(false)
  }

  /* ── voucher processing ───────────────────────────────────────── */
  const openVoucherModal = (req: any) => {
    setSelectedRequest(req)
    setVoucherNo(req.voucher_number || `DV-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`)
    setCheckNo(req.check_number || '')
    setPaymentMethod(req.payment_method || 'Cash')
    setDisbursingOfficer(req.disbursing_officer || profile?.full_name || 'Municipal Treasurer')
    setVoucherNotes(req.notes || '')
    setVoucherModalOpen(true)
  }

  const handleSaveVoucher = async () => {
    if (!selectedRequest) return
    if (!voucherNo.trim()) {
      alert('Disbursement Voucher (DV) Number is required')
      return
    }

    setProcessingAction(true)
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_voucher',
          requestId: selectedRequest.id,
          voucherNumber: voucherNo.trim(),
          checkNumber: checkNo.trim() || null,
          paymentMethod,
          disbursingOfficer: disbursingOfficer.trim() || profile?.full_name || 'Municipal Treasurer',
          notes: voucherNotes.trim() || null
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to process voucher')

      alert('Disbursement Voucher processed! Request is now Ready for Release.')
      setVoucherModalOpen(false)
      load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setProcessingAction(false)
    }
  }

  /* ── confirm release ──────────────────────────────────────────── */
  const handleConfirmRelease = async (req: any) => {
    if (!req.amount_approved || Number(req.amount_approved) <= 0) {
      alert('Cannot release: Approved amount is missing or zero.')
      return
    }

    const benName = req.beneficiaries ? `${req.beneficiaries.first_name} ${req.beneficiaries.last_name}` : 'the beneficiary'
    if (!confirm(`Confirm disbursement of ${formatPHP(Number(req.amount_approved))} to ${benName}? This will deduct the fund balance and create payout and ledger records.`)) {
      return
    }

    setProcessingAction(true)
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_release',
          requestId: req.id,
          notes: 'Disbursed and confirmed via Treasurer Dashboard'
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to confirm release')

      alert('Assistance released and recorded successfully!')
      load()
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
      load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setProcessingAction(false)
    }
  }

  /* ── filtered list ────────────────────────────────────────────── */
  const displayedRequests = requests.filter(r => {
    const rStatus = r.release_status || 'Pending Release'
    const matchRelease = releaseFilter ? rStatus === releaseFilter : true
    const matchType    = type ? r.assistance_type === type : true
    const matchSearch  = search
      ? `${r.beneficiaries?.first_name} ${r.beneficiaries?.last_name} ${r.id} ${r.voucher_number || ''}`
          .toLowerCase().includes(search.toLowerCase())
      : true
    return matchRelease && matchType && matchSearch
  })

  const activeFilterLabel = (() => {
    const parts: string[] = []
    if (releaseFilter) parts.push(releaseFilter)
    if (type) parts.push(type)
    if (search) parts.push(`"${search}"`)
    return parts.join(' · ')
  })()

  const hasActiveFilter = !!(activeCard || activeFund || releaseFilter || type || search)

  const availableBreakdown = funds.map(f => ({
    name:    f.assistance_type,
    balance: Number(f.current_balance),
    pct:     f.total_allocated > 0 ? Math.round((Number(f.current_balance) / Number(f.total_allocated)) * 100) : 0,
  }))

  return (
    <div className="space-y-6" id="treasurer-page">

      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              {t('nav_treasurerDashboard')}
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Municipality of Daanbantayan
            </span>
          </div>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
            Financial clearance, fund tracking, voucher processing, and assistance disbursements.
          </p>
        </div>

        {/* ── Quick Action Buttons ──────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/requests"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 shadow-sm transition-colors">
            <ClipboardList size={14} />
            All Requests
          </Link>
          <Link href="/payouts"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors">
            <CreditCard size={14} />
            Record Payout
          </Link>
          <Link href="/treasurer/funds"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
            <Wallet size={14} />
            Fund Allocation
          </Link>
          <Link href="/treasurer/reports"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
            <BarChart2 size={14} />
            Financial Report
          </Link>
          <Link href="/treasurer/transactions"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
            <ScrollText size={14} />
            Ledger
          </Link>
        </div>
      </div>

      {/* ── 6 KPI Summary Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">

        {/* 1. Total Funds Received */}
        <button
          id="card-total-funds"
          onClick={() => handleCardClick('total_funds')}
          style={{ textAlign: 'left' }}
          className={[
            'rounded-2xl p-4 border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-400',
            'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/50',
            activeCard === 'total_funds'
              ? 'ring-2 ring-indigo-500 scale-[1.02] shadow-lg shadow-indigo-500/20'
              : 'hover:scale-[1.015] hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700',
          ].join(' ')}
          aria-pressed={activeCard === 'total_funds'}
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-2.5 group-hover:bg-indigo-200 transition-colors">
            <Wallet size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-base font-extrabold text-indigo-700 dark:text-indigo-300 leading-tight">
            {formatPHP(totalFundsBudget)}
          </p>
          <p className="text-[11px] font-semibold text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">Total Funds</p>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">Budget Received</span>
        </button>

        {/* 2. Total Allocated Funds */}
        <button
          id="card-total-allocated"
          onClick={() => handleCardClick('total_allocated')}
          style={{ textAlign: 'left' }}
          className={[
            'rounded-2xl p-4 border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-amber-400',
            'bg-amber-50/70 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50',
            activeCard === 'total_allocated'
              ? 'ring-2 ring-amber-500 scale-[1.02] shadow-lg shadow-amber-500/20'
              : 'hover:scale-[1.015] hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700',
          ].join(' ')}
          aria-pressed={activeCard === 'total_allocated'}
        >
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-2.5 group-hover:bg-amber-200 transition-colors">
            <Clock size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-base font-extrabold text-amber-700 dark:text-amber-300 leading-tight">
            {formatPHP(totalEarmarkedAllocated)}
          </p>
          <p className="text-[11px] font-semibold text-amber-600/80 dark:text-amber-400/80 mt-0.5">Total Allocated</p>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">Earmarked for Requests</span>
        </button>

        {/* 3. Total Released Funds */}
        <button
          id="card-total-released"
          onClick={() => handleCardClick('released')}
          style={{ textAlign: 'left' }}
          className={[
            'rounded-2xl p-4 border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-orange-400',
            'bg-orange-50/70 dark:bg-orange-950/40 border-orange-100 dark:border-orange-900/50',
            activeCard === 'released'
              ? 'ring-2 ring-orange-500 scale-[1.02] shadow-lg shadow-orange-500/20'
              : 'hover:scale-[1.015] hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700',
          ].join(' ')}
          aria-pressed={activeCard === 'released'}
        >
          <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center mb-2.5 group-hover:bg-orange-200 transition-colors">
            <ArrowDownRight size={16} className="text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-base font-extrabold text-orange-700 dark:text-orange-300 leading-tight">
            {formatPHP(totalReleased)}
          </p>
          <p className="text-[11px] font-semibold text-orange-600/80 dark:text-orange-400/80 mt-0.5">Total Released</p>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">Disbursed to Beneficiaries</span>
        </button>

        {/* 4. Remaining Balance */}
        <div className="relative" ref={tooltipRef}>
          <button
            id="card-remaining-balance"
            onClick={() => handleCardClick('available')}
            style={{ textAlign: 'left' }}
            className={[
              'w-full rounded-2xl p-4 border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-emerald-400',
              'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50',
              activeCard === 'available'
                ? 'ring-2 ring-emerald-500 scale-[1.02] shadow-lg shadow-emerald-500/20'
                : 'hover:scale-[1.015] hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700',
            ].join(' ')}
            aria-pressed={activeCard === 'available'}
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-2.5 group-hover:bg-emerald-200 transition-colors">
              <Briefcase size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 leading-tight">
              {formatPHP(totalAvailable)}
            </p>
            <p className="text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Remaining Balance</p>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">Available in Treasury</span>
          </button>

          {/* Breakdown tooltip */}
          {showTooltip && (
            <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fund Breakdown</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowTooltip(false) }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="space-y-2">
                {availableBreakdown.map(b => (
                  <div key={b.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{b.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatPHP(b.balance)}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({b.pct}%)</span>
                    </div>
                  </div>
                ))}
                <div className="border-t border-slate-100 dark:border-slate-700 pt-2 mt-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total</span>
                  <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">{formatPHP(totalAvailable)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. Pending Transactions */}
        <button
          id="card-pending-releases"
          onClick={() => handleCardClick('pending')}
          style={{ textAlign: 'left' }}
          className={[
            'rounded-2xl p-4 border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-400',
            'bg-blue-50/70 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50',
            activeCard === 'pending'
              ? 'ring-2 ring-blue-500 scale-[1.02] shadow-lg shadow-blue-500/20'
              : 'hover:scale-[1.015] hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700',
          ].join(' ')}
          aria-pressed={activeCard === 'pending'}
        >
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-2.5 group-hover:bg-blue-200 transition-colors">
            <AlertCircle size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-xl font-extrabold text-blue-700 dark:text-blue-300">{pendingCount}</p>
          <p className="text-[11px] font-semibold text-blue-600/80 dark:text-blue-400/80 mt-0.5">Pending Releases</p>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">Waiting for Voucher/Release</span>
        </button>

        {/* 6. Total Requests */}
        <Link
          href="/requests"
          id="card-total-requests"
          style={{ textAlign: 'left' }}
          className={[
            'rounded-2xl p-4 border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-violet-400 block',
            'bg-violet-50/70 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/50',
            'hover:scale-[1.015] hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700',
          ].join(' ')}
        >
          <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center mb-2.5 group-hover:bg-violet-200 transition-colors">
            <ClipboardList size={16} className="text-violet-600 dark:text-violet-400" />
          </div>
          <p className="text-xl font-extrabold text-violet-700 dark:text-violet-300">{totalRequestsCount}</p>
          <p className="text-[11px] font-semibold text-violet-600/80 dark:text-violet-400/80 mt-0.5">Total Requests</p>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-0.5 group-hover:text-violet-600 transition-colors font-medium">
            View All Requests <ChevronRight size={10} />
          </span>
        </Link>

      </div>

      {/* ── Fund Balances ─────────────────────────────────────────── */}
      {funds.length > 0 && (
        <div id="fund-balances-section">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Municipal Fund Balances by Assistance Type
            </h2>
            <Link href="/treasurer/funds" className="text-xs font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1">
              <PieChart size={13} /> Manage Allocations
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {funds.map((fund) => {
              const pct      = fund.total_allocated > 0 ? (Number(fund.current_balance) / Number(fund.total_allocated)) * 100 : 0
              const isLow    = Number(fund.current_balance) <= Number(fund.low_balance_threshold)
              const isActive = activeFund === fund.assistance_type
              return (
                <button
                  key={fund.id}
                  id={`fund-card-${fund.assistance_type.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => handleFundClick(fund.assistance_type)}
                  style={{ textAlign: 'left' }}
                  className={[
                    'rounded-2xl border p-4 shadow-sm transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-400',
                    'bg-white dark:bg-slate-800',
                    isLow
                      ? 'border-orange-300 dark:border-orange-700'
                      : 'border-slate-200 dark:border-slate-700',
                    isActive
                      ? 'ring-2 ring-[var(--color-primary)] scale-[1.02] shadow-lg'
                      : 'hover:scale-[1.015] hover:shadow-md hover:border-[var(--color-primary)]/50',
                  ].join(' ')}
                  aria-pressed={isActive}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{fund.assistance_type}</h3>
                      <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {formatPHP(fund.current_balance)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {isLow && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/40 px-2 py-1 rounded-lg">
                          <AlertCircle size={10} /> Low
                        </span>
                      )}
                      {isActive && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-primary)] bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                          <Filter size={9} /> Active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-orange-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                    <span>{Math.round(pct)}% remaining</span>
                    <span>of {formatPHP(fund.total_allocated)}</span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-500 flex justify-between">
                    <span>Released: <strong className="text-emerald-600 dark:text-emerald-400">{formatPHP(fund.total_released)}</strong></span>
                    <span>Limit: {formatPHP(fund.low_balance_threshold)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Active Filter Banner ──────────────────────────────────── */}
      {hasActiveFilter && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-sm">
          <div className="flex items-center gap-2 text-[var(--color-primary)] font-semibold flex-wrap">
            <Filter size={14} />
            <span>Filtered{activeFilterLabel ? `: ${activeFilterLabel}` : ''}</span>
            <span className="text-[var(--color-text-secondary)] font-normal">
              — {displayedRequests.length} result{displayedRequests.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline whitespace-nowrap"
          >
            <X size={12} /> Clear all
          </button>
        </div>
      )}

      {/* ── Search & Filter Controls ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveCard(null) }}
            placeholder="Search by beneficiary name, request ID, or DV number..."
            className="form-input pl-10"
            id="request-search"
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
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => {
              const val = e.target.value
              setType(val)
              setActiveFund(val || null)
              setActiveCard(null)
            }}
            className="form-input flex-1 sm:flex-none sm:w-auto sm:min-w-[150px]"
            id="type-filter"
          >
            <option value="">All Assistance Types</option>
            {ASSISTANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={releaseFilter}
            onChange={(e) => { setReleaseFilter(e.target.value); setActiveCard(null) }}
            className="form-input flex-1 sm:flex-none sm:w-auto sm:min-w-[160px]"
            id="release-status-filter"
          >
            <option value="">All Release Statuses</option>
            {RELEASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── Quick Tabs ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap -mt-2">
        {['', ...RELEASE_STATUSES].map(tab => {
          const count = tab === ''
            ? requests.length
            : requests.filter(r => (r.release_status || 'Pending Release') === tab).length
          const isActive = releaseFilter === tab
          return (
            <button
              key={tab}
              id={`tab-${tab.replace(/\s+/g, '-').toLowerCase() || 'all'}`}
              onClick={() => { setReleaseFilter(tab); setActiveCard(null) }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isActive
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]'
              }`}
            >
              {tab || 'All Approved'} <span className="ml-1 opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* ── Approved Requests Table ───────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm text-[var(--color-text)]">Approved Assistance Requests for Disbursement</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
              {displayedRequests.length}
            </span>
          </div>
          <Link href="/treasurer/requests" className="text-xs text-[var(--color-primary)] font-semibold hover:underline">
            View Full Request Queue →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table" id="treasurer-requests-table">
            <thead>
              <tr>
                <th>Beneficiary Name</th>
                <th>Barangay</th>
                <th>Assistance Type</th>
                <th>Approved Amount</th>
                <th>Release Status</th>
                <th>Voucher / Check #</th>
                <th>Date Approved</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton h-5 w-full" /></td>)}</tr>
                ))
              ) : displayedRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <FileText size={28} className="text-slate-300 dark:text-slate-600" />
                      </div>
                      <div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">No records found</p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                          {hasActiveFilter
                            ? 'No requests match the current filters.'
                            : 'No approved requests waiting for release.'}
                        </p>
                      </div>
                      {hasActiveFilter && (
                        <button
                          onClick={clearAll}
                          className="text-xs font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1"
                        >
                          <X size={11} /> Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : displayedRequests.map((r: any) => {
                const rStatus = r.release_status || 'Pending Release'
                const st = RELEASE_STATUS_STYLE[rStatus] || RELEASE_STATUS_STYLE['Pending Release']
                return (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="font-semibold text-[var(--color-text)]">
                      <Link href={`/requests/${r.id}`} className="hover:text-[var(--color-primary)] hover:underline">
                        {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
                      </Link>
                      <span className="block text-[10px] text-slate-400">Ref: #{r.id.slice(0, 8).toUpperCase()}</span>
                    </td>
                    <td className="text-sm text-[var(--color-text-secondary)]">
                      {r.beneficiaries?.barangay ?? '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleFundClick(r.assistance_type)}
                        title={`Filter by ${r.assistance_type}`}
                        className={`badge cursor-pointer transition-all hover:scale-105 ${
                          activeFund === r.assistance_type
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400'
                            : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {r.assistance_type}
                      </button>
                    </td>
                    <td className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {r.amount_approved ? `₱${Number(r.amount_approved).toLocaleString()}` : <span className="text-slate-400">—</span>}
                    </td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}>
                        {rStatus}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--color-text-secondary)] font-mono">
                      {r.voucher_number || r.extra_fields?.voucher_number || '—'}
                    </td>
                    <td className="text-slate-500 text-xs">{format(new Date(r.created_at), 'MMM d, yyyy')}</td>
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rStatus !== 'Released' && (
                          <button
                            onClick={() => openVoucherModal(r)}
                            title="Process Disbursement Voucher"
                            className="px-2 py-1 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                          >
                            Voucher
                          </button>
                        )}
                        {rStatus !== 'Released' && (
                          <button
                            onClick={() => handleConfirmRelease(r)}
                            title="Confirm physical disbursement"
                            className="px-2 py-1 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                          >
                            Release
                          </button>
                        )}
                        {rStatus !== 'Released' && (
                          <button
                            onClick={() => openReturnModal(r)}
                            title="Return request to Admin"
                            className="px-2 py-1 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                          >
                            Return
                          </button>
                        )}
                        <Link
                          href={`/requests/${r.id}`}
                          className="px-2 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Financial Transactions Ledger Widget ──────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2">
              <ScrollText size={16} className="text-indigo-500" /> Recent Treasury Financial Transactions
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Live audit record of budget allocations, disbursements, and fund adjustments.
            </p>
          </div>
          <Link href="/treasurer/transactions" className="text-xs text-[var(--color-primary)] font-semibold hover:underline">
            View Complete Ledger →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-slate-400 uppercase tracking-wider">
                <th className="pb-2 font-semibold">Date & Time</th>
                <th className="pb-2 font-semibold">Type</th>
                <th className="pb-2 font-semibold">Fund</th>
                <th className="pb-2 font-semibold">Beneficiary / Reference</th>
                <th className="pb-2 font-semibold text-right">Amount</th>
                <th className="pb-2 font-semibold text-right">Balance After</th>
                <th className="pb-2 font-semibold">Processed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No financial transactions recorded yet.
                  </td>
                </tr>
              ) : transactions.map((tx: any) => {
                const isAdd = tx.transaction_type === 'Allocation'
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 font-medium text-slate-600 dark:text-slate-300">
                      {format(new Date(tx.created_at), 'MMM d, yyyy • h:mm a')}
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        isAdd
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                      }`}>
                        {isAdd ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="py-2.5 font-semibold text-[var(--color-text)]">
                      {tx.funds?.assistance_type} Assistance
                    </td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-300">
                      {tx.requests?.beneficiaries
                        ? `${tx.requests.beneficiaries.first_name} ${tx.requests.beneficiaries.last_name}`
                        : tx.remarks || 'Municipal Treasury'}
                    </td>
                    <td className={`py-2.5 text-right font-bold ${isAdd ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      {isAdd ? '+' : '-'}{formatPHP(Number(tx.amount))}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">
                      {formatPHP(Number(tx.balance_after))}
                    </td>
                    <td className="py-2.5 text-slate-500">
                      {tx.profiles?.full_name || 'Treasury Officer'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Voucher Processing Modal ──────────────────────────────── */}
      {voucherModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--color-border)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">Process Disbursement Voucher</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Beneficiary: {selectedRequest.beneficiaries?.first_name} {selectedRequest.beneficiaries?.last_name} · Approved Amount: {formatPHP(Number(selectedRequest.amount_approved || 0))}
                </p>
              </div>
              <button onClick={() => setVoucherModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Disbursement Voucher (DV) Number *
                </label>
                <input
                  type="text"
                  className="form-input w-full"
                  placeholder="e.g. DV-2026-10-0089"
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Check / Reference Number (Optional)
                </label>
                <input
                  type="text"
                  className="form-input w-full"
                  placeholder="e.g. CHK-554219"
                  value={checkNo}
                  onChange={(e) => setCheckNo(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Payment Method
                  </label>
                  <select
                    className="form-input w-full"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Digital Wallet">Digital Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Disbursing Officer
                  </label>
                  <input
                    type="text"
                    className="form-input w-full"
                    placeholder="Officer Name"
                    value={disbursingOfficer}
                    onChange={(e) => setDisbursingOfficer(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Notes / Instructions
                </label>
                <textarea
                  className="form-input w-full h-20 text-xs"
                  placeholder="Voucher prepared, ready for beneficiary release..."
                  value={voucherNotes}
                  onChange={(e) => setVoucherNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setVoucherModalOpen(false)}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVoucher}
                disabled={processingAction}
                className="btn btn-primary text-sm flex items-center gap-1.5"
              >
                <CheckCircle size={15} />
                {processingAction ? 'Saving...' : 'Save & Mark Ready for Release'}
              </button>
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
