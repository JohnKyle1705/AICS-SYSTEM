'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus, DollarSign, Search, Filter, ArrowLeft, RefreshCw, CheckCircle2, HeartPulse, ShieldAlert } from 'lucide-react'

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<any[]>([])
  const [funds, setFunds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'All' | 'Medical' | 'Burial'>('All')
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch funds to get official released totals
      const { data: fundsData } = await supabase
        .from('funds')
        .select('*')
        .order('assistance_type')
      if (fundsData) setFunds(fundsData)

      // 2. Fetch existing payouts
      const { data: existingPayouts, error: pErr } = await supabase
        .from('payouts')
        .select('*, requests(id, assistance_type, status, release_status, amount_approved, beneficiaries(first_name, last_name, barangay))')
        .order('created_at', { ascending: false })

      if (pErr) console.warn('Error fetching payouts:', pErr)

      // 3. Fetch released requests to detect any missing from payouts table
      const { data: releasedReqs } = await supabase
        .from('requests')
        .select('id, assistance_type, status, release_status, amount_approved, created_at, updated_at, beneficiaries(first_name, last_name, barangay)')
        .or('status.eq.Released,release_status.eq.Released')

      const recordedReqIds = new Set((existingPayouts || []).map((p: any) => p.request_id))
      const missing = (releasedReqs || []).filter((r: any) => !recordedReqIds.has(r.id) && Number(r.amount_approved) > 0)

      let merged = [...(existingPayouts || [])]

      if (missing.length > 0) {
        const { data: { user } } = await supabase.auth.getUser()

        // Auto-heal: attempt to insert missing records into payouts table
        const toInsert = missing.map((r: any) => ({
          request_id: r.id,
          amount_released: Number(r.amount_approved),
          release_date: (r.updated_at || r.created_at || new Date().toISOString()).split('T')[0],
          released_by: user?.id ?? null,
          acknowledgment_notes: 'Auto-recorded upon release',
        }))

        const { data: inserted } = await supabase
          .from('payouts')
          .insert(toInsert)
          .select('*, requests(id, assistance_type, status, release_status, amount_approved, beneficiaries(first_name, last_name, barangay))')

        if (inserted && inserted.length > 0) {
          merged = [...inserted, ...merged]
        } else {
          // Synthetic items in case client RLS policy doesn't return inserted rows directly
          const synthetic = missing.map((r: any) => ({
            id: `synced-${r.id}`,
            request_id: r.id,
            amount_released: Number(r.amount_approved),
            release_date: (r.updated_at || r.created_at || new Date().toISOString()).split('T')[0],
            released_by: null,
            acknowledgment_notes: 'Released Assistance Record',
            created_at: r.updated_at || r.created_at,
            requests: r
          }))
          merged = [...synthetic, ...merged]
        }
      }

      setPayouts(merged)
    } catch (e: any) {
      console.error('Error loading payouts:', e)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = payouts.filter((p: any) => {
    const ben = p.requests?.beneficiaries
    const name = `${ben?.first_name || ''} ${ben?.last_name || ''}`.toLowerCase()
    const brgy = (ben?.barangay || '').toLowerCase()
    const matchesSearch = name.includes(search.toLowerCase()) || brgy.includes(search.toLowerCase())
    const matchesType = typeFilter === 'All' || p.requests?.assistance_type === typeFilter
    return matchesSearch && matchesType
  })

  const totalPayoutsSum = payouts.reduce((sum: number, p: any) => sum + Number(p.amount_released || 0), 0)
  const totalFundsReleased = funds.reduce((sum: number, f: any) => sum + Number(f.total_released || 0), 0)
  const total = Math.max(totalPayoutsSum, totalFundsReleased)

  const medicalReleased = payouts
    .filter((p: any) => p.requests?.assistance_type === 'Medical')
    .reduce((s: number, p: any) => s + Number(p.amount_released || 0), 0)
  const burialReleased = payouts
    .filter((p: any) => p.requests?.assistance_type === 'Burial')
    .reduce((s: number, p: any) => s + Number(p.amount_released || 0), 0)

  return (
    <div className="space-y-6" id="payouts-page">
      {/* ── Page Header ────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/treasurer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-blue-600 transition-colors"
            >
              <ArrowLeft size={13} /> Back to Treasurer Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Payout Records</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
            Complete disbursement ledger of all released financial assistance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="btn btn-secondary inline-flex items-center gap-1.5"
            title="Refresh records"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link href="/payouts/new" className="btn btn-primary" id="record-payout-btn">
            <Plus size={16} /> Record Payout
          </Link>
        </div>
      </div>

      {/* ── KPI Summary Cards ──────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Released */}
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              Total Released
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300">
            ₱{total.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
            Across all funds & releases
          </div>
        </div>

        {/* Total Transactions */}
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              Transactions
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-300">
            {payouts.length}
          </div>
          <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
            Total payouts recorded
          </div>
        </div>

        {/* Medical Released */}
        <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
              <HeartPulse size={18} className="text-sky-600 dark:text-sky-400" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
              Medical
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-700 dark:text-sky-300">
            ₱{medicalReleased.toLocaleString()}
          </div>
          <div className="text-xs text-sky-600/80 dark:text-sky-400/80 mt-1">
            Medical assistance released
          </div>
        </div>

        {/* Burial Released */}
        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <ShieldAlert size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
              Burial
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-300">
            ₱{burialReleased.toLocaleString()}
          </div>
          <div className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">
            Burial assistance released
          </div>
        </div>
      </div>

      {/* ── Filter & Search Bar ─────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="Search by beneficiary name or barangay..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          {(['All', 'Medical', 'Burial'] as const).map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === type
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table Card ─────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" id="payouts-table">
            <thead>
              <tr>
                {['Beneficiary', 'Barangay', 'Type', 'Amount Released', 'Release Date', 'Notes', 'Action'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j}><div className="skeleton h-5 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <DollarSign size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-400 text-sm font-medium">No payout records found</p>
                    {search && (
                      <p className="text-slate-400 text-xs mt-1">Try clearing your search query</p>
                    )}
                  </td>
                </tr>
              ) : filtered.map((p: any) => {
                const ben = p.requests?.beneficiaries
                const benName = ben ? `${ben.last_name}, ${ben.first_name}` : 'Unknown Beneficiary'
                const reqType = p.requests?.assistance_type || 'General'
                const dateStr = p.release_date ? format(new Date(p.release_date), 'MMM d, yyyy') : '—'

                return (
                  <tr key={p.id}>
                    <td className="font-semibold text-[var(--color-text)]">
                      {benName}
                    </td>
                    <td className="text-[var(--color-text-secondary)]">
                      {ben?.barangay ? `Brgy. ${ben.barangay}` : '—'}
                    </td>
                    <td>
                      <span className={`badge ${
                        reqType === 'Medical'
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      }`}>
                        {reqType}
                      </span>
                    </td>
                    <td className="font-black text-emerald-600 dark:text-emerald-400">
                      ₱{Number(p.amount_released).toLocaleString()}
                    </td>
                    <td className="text-[var(--color-text)]">
                      {dateStr}
                    </td>
                    <td className="max-w-[180px] truncate text-[var(--color-text-secondary)] text-xs">
                      {p.acknowledgment_notes ?? '—'}
                    </td>
                    <td>
                      {p.request_id ? (
                        <Link
                          href={`/requests/${p.request_id}`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-semibold hover:underline"
                        >
                          View Request
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
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
