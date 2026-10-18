'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Request } from '@/types'
import { ASSISTANCE_TYPES } from '@/lib/constants'
import {
  Search, FileText, CheckCircle2, AlertCircle, Briefcase,
  ArrowDownRight, PieChart, BookOpen, CreditCard, X, Info,
  TrendingUp, Filter
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
type ActiveCard = 'pending' | 'approved' | 'available' | 'released' | null
type ActiveFund = string | null

/* ─── component ──────────────────────────────────────────────────── */
export default function TreasurerDashboardPage() {
  const [requests, setRequests]           = useState<Request[]>([])
  const [funds, setFunds]                 = useState<any[]>([])
  const [search, setSearch]               = useState('')
  const [type, setType]                   = useState('')
  const [releaseFilter, setReleaseFilter] = useState('')
  const [loading, setLoading]             = useState(true)
  const [profile, setProfile]             = useState<any>(null)
  const [pendingCount, setPendingCount]   = useState(0)

  const [activeCard, setActiveCard]       = useState<ActiveCard>(null)
  const [activeFund, setActiveFund]       = useState<ActiveFund>(null)
  const [showTooltip, setShowTooltip]     = useState(false)
  const tooltipRef                        = useRef<HTMLDivElement>(null)

  const supabase = createClient()
  const { t }    = useLanguage()

  /* ── data loading ─────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user && !profile) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    }

    const { data } = await supabase
      .from('requests')
      .select('*, beneficiaries(first_name, last_name, barangay)')
      .eq('status', 'Approved')
      .order('created_at', { ascending: false })
    setRequests(data ?? [])

    const { data: fundsData } = await supabase.from('funds').select('*').order('assistance_type')
    setFunds(fundsData ?? [])

    const { count } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Approved')
      .in('release_status', ['Pending Release', 'Ready for Release'])
    setPendingCount(count ?? 0)

    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ── release status update ────────────────────────────────────── */
  const updateReleaseStatus = async (id: string, release_status: string) => {
    const requestDetails = requests.find(r => r.id === id)

    if (release_status === 'Released' && (!requestDetails?.amount_approved || Number(requestDetails.amount_approved) <= 0)) {
      alert('Cannot release this request: Approved amount is missing or zero. Please ask the Admin to set the approved amount first.')
      setRequests([...requests])
      return
    }

    const { error } = await supabase.from('requests').update({ release_status }).eq('id', id)
    if (error) { alert(error.message); return }

    setRequests(prev => prev.map(r => r.id === id ? { ...r, release_status: release_status as any } : r))

    if (release_status === 'Released') {
      const { data: updatedFunds } = await supabase.from('funds').select('*').order('assistance_type')
      if (updatedFunds) setFunds(updatedFunds)
      setPendingCount(c => Math.max(0, c - 1))

      const { data: { user: currentUser } } = await supabase.auth.getUser()
      await supabase.from('payouts').insert({
        request_id: id,
        amount_released: Number(requestDetails?.amount_approved ?? 0),
        release_date: new Date().toISOString().split('T')[0],
        released_by: currentUser?.id ?? null,
        acknowledgment_notes: 'Released via Treasurer Dashboard',
      })
    }

    if (profile) {
      await supabase.from('system_logs').insert({
        user_id: profile.id,
        action: 'UPDATE_RELEASE_STATUS',
        table_name: 'requests',
        record_id: id,
        details: { new_release_status: release_status }
      })
    }

    if (release_status === 'Ready for Release' || release_status === 'For Release') {
      const benName = requestDetails?.beneficiaries
        ? `${requestDetails.beneficiaries.first_name} ${requestDetails.beneficiaries.last_name}` : 'Unknown'
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
      if (admins) {
        await supabase.from('notifications').insert(
          admins.map((admin: any) => ({
            user_id: admin.id,
            title: 'Ready for Release',
            message: `Treasurer Notification: Request for ${benName} is now ready for release.`,
            type: 'info',
            request_id: id
          }))
        )
      }
    }
  }

  /* ── derived totals ───────────────────────────────────────────── */
  const totalAvailable = funds.reduce((s, f) => s + Number(f.current_balance), 0)
  const totalReleased  = funds.reduce((s, f) => s + Number(f.total_released),  0)

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
      if (card === 'pending')   setReleaseFilter('Pending Release')
      else if (card === 'released') setReleaseFilter('Released')
      else { setReleaseFilter(''); if (card === 'available') setShowTooltip(true) }
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

  /* ── filtered list ────────────────────────────────────────────── */
  const displayedRequests = requests.filter(r => {
    const rStatus = (r as any).release_status || 'Pending Release'
    const matchRelease = releaseFilter ? rStatus === releaseFilter : true
    const matchType    = type ? (r as any).assistance_type === type : true
    const matchSearch  = search
      ? `${(r as any).beneficiaries?.first_name} ${(r as any).beneficiaries?.last_name}`
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

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6" id="treasurer-page">

      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {t('nav_treasurerDashboard')}
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
            {requests.length} approved request{requests.length !== 1 ? 's' : ''} awaiting release
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/payouts"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
            <CreditCard size={14} />
            Payouts
          </Link>
          <Link href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
            <BookOpen size={14} />
            Ledger
          </Link>
        </div>
      </div>

      {/* ── KPI Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

        {/* Pending Releases */}
        <button
          id="card-pending-releases"
          onClick={() => handleCardClick('pending')}
          style={{ textAlign: 'left' }}
          className={[
            'rounded-2xl p-4 border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-400',
            'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50',
            activeCard === 'pending'
              ? 'ring-2 ring-blue-500 scale-[1.02] shadow-lg shadow-blue-500/20'
              : 'hover:scale-[1.015] hover:shadow-md hover:shadow-blue-500/10 hover:border-blue-300 dark:hover:border-blue-700',
          ].join(' ')}
          aria-pressed={activeCard === 'pending'}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/60 transition-colors">
              <AlertCircle size={17} className="text-blue-600 dark:text-blue-400" />
            </div>
            {pendingCount > 0 && (
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                Action needed
              </span>
            )}
          </div>
          <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">{pendingCount}</p>
          <p className="text-xs font-semibold text-blue-600/70 dark:text-blue-400/70 mt-0.5">Pending Releases</p>
          {activeCard === 'pending' && (
            <p className="mt-2 text-[10px] font-semibold text-blue-500 dark:text-blue-400 flex items-center gap-1">
              <Filter size={9} /> Filtering by Pending Release
            </p>
          )}
        </button>

        {/* Total Approved */}
        <button
          id="card-total-approved"
          onClick={() => handleCardClick('approved')}
          style={{ textAlign: 'left' }}
          className={[
            'rounded-2xl p-4 border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-violet-400',
            'bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/50',
            activeCard === 'approved'
              ? 'ring-2 ring-violet-500 scale-[1.02] shadow-lg shadow-violet-500/20'
              : 'hover:scale-[1.015] hover:shadow-md hover:shadow-violet-500/10 hover:border-violet-300 dark:hover:border-violet-700',
          ].join(' ')}
          aria-pressed={activeCard === 'approved'}
        >
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center mb-3 group-hover:bg-violet-200 dark:group-hover:bg-violet-800/60 transition-colors">
            <FileText size={17} className="text-violet-600 dark:text-violet-400" />
          </div>
          <p className="text-2xl font-extrabold text-violet-700 dark:text-violet-300">{requests.length}</p>
          <p className="text-xs font-semibold text-violet-600/70 dark:text-violet-400/70 mt-0.5">Total Approved</p>
          {activeCard === 'approved' && (
            <p className="mt-2 text-[10px] font-semibold text-violet-500 dark:text-violet-400 flex items-center gap-1">
              <Filter size={9} /> Showing all approved
            </p>
          )}
        </button>

        {/* Total Available — with breakdown tooltip */}
        <div className="relative" ref={tooltipRef}>
          <button
            id="card-total-available"
            onClick={() => handleCardClick('available')}
            style={{ textAlign: 'left' }}
            className={[
              'w-full rounded-2xl p-4 border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-emerald-400',
              'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50',
              activeCard === 'available'
                ? 'ring-2 ring-emerald-500 scale-[1.02] shadow-lg shadow-emerald-500/20'
                : 'hover:scale-[1.015] hover:shadow-md hover:shadow-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-700',
            ].join(' ')}
            aria-pressed={activeCard === 'available'}
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-3 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/60 transition-colors">
              <Briefcase size={17} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 leading-tight">{formatPHP(totalAvailable)}</p>
            <p className="text-xs font-semibold text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Total Available</p>
            {activeCard === 'available' && (
              <p className="mt-2 text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                <Info size={9} /> Breakdown shown ↓
              </p>
            )}
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

        {/* Total Released */}
        <button
          id="card-total-released"
          onClick={() => handleCardClick('released')}
          style={{ textAlign: 'left' }}
          className={[
            'rounded-2xl p-4 border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-orange-400',
            'bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-900/50',
            activeCard === 'released'
              ? 'ring-2 ring-orange-500 scale-[1.02] shadow-lg shadow-orange-500/20'
              : 'hover:scale-[1.015] hover:shadow-md hover:shadow-orange-500/10 hover:border-orange-300 dark:hover:border-orange-700',
          ].join(' ')}
          aria-pressed={activeCard === 'released'}
        >
          <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center mb-3 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/60 transition-colors">
            <ArrowDownRight size={17} className="text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-lg font-extrabold text-orange-700 dark:text-orange-300 leading-tight">{formatPHP(totalReleased)}</p>
          <p className="text-xs font-semibold text-orange-600/70 dark:text-orange-400/70 mt-0.5">Total Released</p>
          {activeCard === 'released' && (
            <p className="mt-2 text-[10px] font-semibold text-orange-500 dark:text-orange-400 flex items-center gap-1">
              <Filter size={9} /> Filtering by Released
            </p>
          )}
        </button>
      </div>

      {/* ── Fund Balances ─────────────────────────────────────────── */}
      {funds.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Fund Balances</h2>
            <Link href="/dashboard" className="text-xs font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1">
              <PieChart size={12} /> View Funds Dashboard
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

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-500">
                    Released: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatPHP(fund.total_released)}</span>
                  </div>

                  {isActive && (
                    <p className="mt-1.5 text-[10px] font-semibold text-[var(--color-primary)]">
                      Click again to clear filter
                    </p>
                  )}
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

      {/* ── Search & Filters ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveCard(null) }}
            placeholder={t('requests_searchPlaceholder')}
            className="form-input pl-10"
            id="request-search"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
            <option value="">{t('requests_allTypes')}</option>
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

      {/* ── Quick Release Filter Tabs ─────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap -mt-2">
        {['', ...RELEASE_STATUSES].map(tab => {
          const count = tab === ''
            ? requests.length
            : requests.filter(r => ((r as any).release_status || 'Pending Release') === tab).length
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
              {tab || 'All'} <span className="ml-1 opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* ── Requests Table ────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" id="treasurer-requests-table">
            <thead>
              <tr>
                <th>{t('requests_beneficiary')}</th>
                <th>Barangay</th>
                <th>{t('requests_type')}</th>
                <th>Approved Amount</th>
                <th>Release Status</th>
                <th>{t('requests_date')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="skeleton h-5 w-full" /></td>)}</tr>
                ))
              ) : displayedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
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
                      {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
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
                      <select
                        value={rStatus}
                        onChange={(e) => updateReleaseStatus(r.id, e.target.value)}
                        className={`border rounded-lg px-2 py-1 text-xs font-semibold cursor-pointer focus:outline-none ${st.bg} ${st.text} ${st.border}`}
                      >
                        {RELEASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="text-slate-500 text-xs">{format(new Date(r.created_at), 'MMM d, yyyy')}</td>
                    <td>
                      <Link href={`/requests/${r.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline">
                        <CheckCircle2 size={12} /> {t('view')}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
