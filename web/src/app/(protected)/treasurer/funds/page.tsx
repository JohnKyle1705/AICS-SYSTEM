'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Wallet, AlertTriangle, History, ArrowUpRight, ArrowDownRight,
  PlusCircle, RefreshCw, XCircle, CheckCircle, PieChart, ShieldAlert,
  Calendar, FileText, ChevronRight, Info
} from 'lucide-react'
import { format } from 'date-fns'

export default function TreasurerFundsPage() {
  const supabase = createClient()
  const [funds, setFunds]               = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [profile, setProfile]           = useState<any>(null)

  // Replenishment Modal State
  const [modalOpen, setModalOpen]               = useState(false)
  const [selectedFundId, setSelectedFundId]     = useState('')
  const [transactionType, setTransactionType]   = useState<'Allocation' | 'Adjustment'>('Allocation')
  const [amount, setAmount]                     = useState('')
  const [source, setSource]                     = useState('Municipal General Fund Appropriation')
  const [referenceNo, setReferenceNo]           = useState('')
  const [threshold, setThreshold]               = useState('')
  const [remarks, setRemarks]                   = useState('')
  const [submitting, setSubmitting]             = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user && !profile) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    }

    // Fetch Funds
    const { data: fundsData } = await supabase.from('funds').select('*').order('assistance_type')
    setFunds(fundsData || [])

    if (fundsData && fundsData.length > 0 && !selectedFundId) {
      setSelectedFundId(fundsData[0].id)
      setThreshold(fundsData[0].low_balance_threshold?.toString() || '0')
    }

    // Accurate Pending Count (Approved requests not yet released)
    const { count } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Approved')
      .or('release_status.is.null,release_status.neq.Released')
    setPendingCount(count || 0)

    // Recent Transactions
    const { data: txData } = await supabase
      .from('fund_transactions')
      .select('*, profiles(full_name), funds(assistance_type)')
      .order('created_at', { ascending: false })
      .limit(8)
    setTransactions(txData || [])

    setLoading(false)
  }, [profile, selectedFundId])

  useEffect(() => { loadData() }, [loadData])

  const formatPHP = (val: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val)

  // Calculate totals
  const totalAvailable = funds.reduce((sum, f) => sum + Number(f.current_balance || 0), 0)
  const totalAllocated = funds.reduce((sum, f) => sum + Number(f.total_allocated || 0), 0)
  const totalReleased  = funds.reduce((sum, f) => sum + Number(f.total_released || 0), 0)

  const openReplenishModal = (fundId?: string) => {
    const targetId = fundId || (funds[0] ? funds[0].id : '')
    setSelectedFundId(targetId)
    const f = funds.find(x => x.id === targetId)
    if (f) {
      setThreshold(f.low_balance_threshold?.toString() || '0')
    }
    setAmount('')
    setReferenceNo(`ORD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`)
    setRemarks('')
    setTransactionType('Allocation')
    setModalOpen(true)
  }

  const handleSubmitReplenishment = async () => {
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount greater than 0.')
      return
    }

    if (!selectedFundId) {
      alert('Please select a fund')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_fund_transaction',
          userId: profile?.id,
          fundId: selectedFundId,
          type: transactionType,
          amount: numAmount,
          remarks: `${source} • Ref: ${referenceNo || 'N/A'}${remarks ? ` • ${remarks}` : ''}`,
          newThreshold: threshold ? parseFloat(threshold) : undefined
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record fund transaction')

      alert(`Fund ${transactionType.toLowerCase()} saved successfully!`)
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Municipal Fund Tracking & Budget Management</h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Office of the Municipal Treasurer
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Real-time municipal treasury ledger, appropriations, and assistance allocations for Daanbantayan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/treasurer/transactions"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <History size={14} /> View Full Ledger
          </Link>
          <button
            onClick={() => openReplenishModal()}
            className="btn btn-primary text-xs flex items-center gap-1.5"
          >
            <PlusCircle size={14} /> Record Budget Replenishment
          </button>
        </div>
      </div>

      {/* ── Low Balance Alerts ────────────────────────────────────── */}
      {funds.map(fund => {
        const isLow = Number(fund.current_balance) <= Number(fund.low_balance_threshold)
        if (!isLow) return null
        return (
          <div key={fund.id} className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                  Low Balance Alert: {fund.assistance_type} Assistance
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
                  Available funds ({formatPHP(Number(fund.current_balance))}) are at or below the minimum threshold ({formatPHP(Number(fund.low_balance_threshold))}). Releasing funds beyond this threshold requires budget replenishment.
                </p>
              </div>
            </div>
            <button
              onClick={() => openReplenishModal(fund.id)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 shrink-0"
            >
              Replenish Now
            </button>
          </div>
        )
      })}

      {/* ── Summary Statistics Cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Available Funds</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
              <Wallet size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatPHP(totalAvailable)}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Ready for disbursement</span>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Budget Received</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatPHP(totalAllocated)}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Cumulative appropriations</span>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Disbursed</span>
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 flex items-center justify-center">
              <ArrowDownRight size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{formatPHP(totalReleased)}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Successfully disbursed</span>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pending Releases</span>
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 flex items-center justify-center">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-violet-600 dark:text-violet-400">{pendingCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Approved awaiting payout</span>
        </div>
      </div>

      {/* ── Separate Fund Balances & Health ───────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Assistance Funds Status & Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {funds.map((fund) => {
            const pct = fund.total_allocated > 0 ? (Number(fund.current_balance) / Number(fund.total_allocated)) * 100 : 0
            const isLow = Number(fund.current_balance) <= Number(fund.low_balance_threshold)

            return (
              <div key={fund.id} className="card p-6 border-l-4 border-blue-500 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--color-text)]">{fund.assistance_type} Assistance Fund</h3>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Municipal Aid Allocation</p>
                  </div>
                  <button
                    onClick={() => openReplenishModal(fund.id)}
                    className="btn btn-secondary text-xs flex items-center gap-1"
                  >
                    <PlusCircle size={13} /> Add Allocation
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--color-border)] text-xs">
                  <div>
                    <span className="text-slate-400 block">Available Balance:</span>
                    <strong className="text-sm text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      {formatPHP(Number(fund.current_balance))}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Total Budget:</span>
                    <strong className="text-sm text-slate-800 dark:text-white block mt-0.5">
                      {formatPHP(Number(fund.total_allocated))}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Released / Paid:</span>
                    <strong className="text-sm text-orange-600 dark:text-orange-400 block mt-0.5">
                      {formatPHP(Number(fund.total_released))}
                    </strong>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-500">Fund Utilization</span>
                    <span className="text-[var(--color-text)] font-bold">{Math.round(pct)}% Available ({100 - Math.round(pct)}% Used)</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>Threshold Limit: {formatPHP(Number(fund.low_balance_threshold))}</span>
                    <span>Status: {isLow ? '⚠️ Running Low' : '✅ Healthy'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Recent Allocations & Adjustments ──────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
              <History size={16} className="text-indigo-500" /> Recent Fund Transactions & Allocations
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Audit log of budget injections and disbursements.</p>
          </div>
          <Link href="/treasurer/transactions" className="text-xs font-semibold text-blue-600 hover:underline">
            View Ledger →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-slate-400 uppercase tracking-wider">
                <th className="pb-2 font-semibold">Date</th>
                <th className="pb-2 font-semibold">Type</th>
                <th className="pb-2 font-semibold">Fund</th>
                <th className="pb-2 font-semibold">Source / Remarks</th>
                <th className="pb-2 font-semibold text-right">Amount</th>
                <th className="pb-2 font-semibold text-right">Balance After</th>
                <th className="pb-2 font-semibold">Encoded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No transactions recorded.
                  </td>
                </tr>
              ) : transactions.map((tx: any) => {
                const isAdd = tx.transaction_type === 'Allocation'
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 text-slate-600 dark:text-slate-300">
                      {format(new Date(tx.created_at), 'MMM d, yyyy • h:mm a')}
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        isAdd ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                      }`}>
                        {isAdd ? '+' : '-'}{tx.transaction_type}
                      </span>
                    </td>
                    <td className="py-2.5 font-semibold text-[var(--color-text)]">
                      {tx.funds?.assistance_type}
                    </td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-300">
                      {tx.remarks || 'Municipal Treasury Operation'}
                    </td>
                    <td className={`py-2.5 text-right font-bold ${isAdd ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      {isAdd ? '+' : '-'}{formatPHP(Number(tx.amount))}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">
                      {formatPHP(Number(tx.balance_after))}
                    </td>
                    <td className="py-2.5 text-slate-500">
                      {tx.profiles?.full_name || 'Treasurer Officer'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Replenishment Modal ───────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--color-border)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">Record Fund Replenishment / Budget</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">Municipal Assistance Fund Injection</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Target Fund *
                </label>
                <select
                  className="form-input w-full"
                  value={selectedFundId}
                  onChange={(e) => {
                    const id = e.target.value
                    setSelectedFundId(id)
                    const f = funds.find(x => x.id === id)
                    if (f) setThreshold(f.low_balance_threshold?.toString() || '0')
                  }}
                >
                  {funds.map(f => (
                    <option key={f.id} value={f.id}>{f.assistance_type} Assistance (Current: {formatPHP(Number(f.current_balance))})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Action Type
                  </label>
                  <select
                    className="form-input w-full"
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as any)}
                  >
                    <option value="Allocation">Add Budget (Replenishment)</option>
                    <option value="Adjustment">Adjustment / Correction</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Amount (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input w-full font-bold text-emerald-600"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Fund Source / Origin *
                </label>
                <input
                  type="text"
                  className="form-input w-full"
                  placeholder="e.g. Municipal General Fund, Calamity Fund, Supplemental Budget"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Ordinance / Resolution #
                  </label>
                  <input
                    type="text"
                    className="form-input w-full"
                    placeholder="e.g. ORD-2026-08"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Low Balance Warning Limit (₱)
                  </label>
                  <input
                    type="number"
                    className="form-input w-full"
                    placeholder="e.g. 50000"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Notes & Details
                </label>
                <textarea
                  className="form-input w-full h-18 text-xs"
                  placeholder="Additional municipal notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReplenishment}
                disabled={submitting}
                className="btn btn-primary text-sm flex items-center gap-1.5"
              >
                <PlusCircle size={15} />
                {submitting ? 'Recording...' : 'Confirm Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
