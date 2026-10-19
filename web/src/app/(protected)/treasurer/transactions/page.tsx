'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ScrollText, Search, ArrowUpRight, ArrowDownRight, Filter,
  RotateCcw, Calendar, Download, RefreshCw, XCircle, AlertCircle,
  FileText, CheckCircle2, ChevronRight, X
} from 'lucide-react'
import { format } from 'date-fns'

const TX_TYPES = ['All', 'Allocation', 'Release', 'Adjustment', 'Reversal']

export default function TreasurerTransactionsPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [typeFilter, setTypeFilter]     = useState('All')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [profile, setProfile]           = useState<any>(null)

  // Reversal Modal State
  const [reversalModalOpen, setReversalModalOpen] = useState(false)
  const [selectedTx, setSelectedTx]               = useState<any>(null)
  const [reversalReason, setReversalReason]       = useState('')
  const [reversing, setReversing]                 = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user && !profile) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    }

    const { data, error } = await supabase
      .from('fund_transactions')
      .select('*, funds(assistance_type), profiles(full_name), requests(id, beneficiaries(first_name, last_name, barangay))')
      .order('created_at', { ascending: false })

    if (error) console.error('Error fetching transactions:', error)
    setTransactions(data ?? [])
    setLoading(false)
  }, [profile])

  useEffect(() => { loadData() }, [loadData])

  const formatPHP = (val: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val)

  /* ── reversal handling ────────────────────────────────────────── */
  const openReversalModal = (tx: any) => {
    setSelectedTx(tx)
    setReversalReason('')
    setReversalModalOpen(true)
  }

  const handleConfirmReversal = async () => {
    if (!selectedTx) return
    if (!reversalReason.trim()) {
      alert('A valid justification/reason is required for transaction reversal')
      return
    }

    setReversing(true)
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reverse_transaction',
          userId: profile?.id,
          transactionId: selectedTx.id,
          reason: reversalReason.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reverse transaction')

      alert('Transaction reversed successfully! Fund balance restored.')
      setReversalModalOpen(false)
      loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setReversing(false)
    }
  }

  /* ── filter matching ──────────────────────────────────────────── */
  const filteredTransactions = transactions.filter(tx => {
    const matchesType = typeFilter === 'All' || tx.transaction_type === typeFilter
    const matchesFrom = dateFrom ? tx.created_at >= dateFrom : true
    const matchesTo   = dateTo ? tx.created_at <= dateTo + 'T23:59:59' : true
    const q = search.toLowerCase()
    const matchesSearch = !search
      ? true
      : tx.funds?.assistance_type?.toLowerCase().includes(q) ||
        tx.profiles?.full_name?.toLowerCase().includes(q) ||
        tx.remarks?.toLowerCase().includes(q) ||
        tx.requests?.beneficiaries?.first_name?.toLowerCase().includes(q) ||
        tx.requests?.beneficiaries?.last_name?.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q)

    return matchesType && matchesFrom && matchesTo && matchesSearch
  })

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Transaction ID', 'Date', 'Type', 'Assistance Type', 'Beneficiary / Description', 'Amount', 'Balance After', 'Processed By', 'Remarks']
    const rows = filteredTransactions.map(tx => [
      tx.id,
      format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss'),
      tx.transaction_type,
      tx.funds?.assistance_type || '',
      tx.requests?.beneficiaries ? `${tx.requests.beneficiaries.first_name} ${tx.requests.beneficiaries.last_name}` : 'Treasury Allocation',
      tx.amount,
      tx.balance_after,
      tx.profiles?.full_name || '',
      (tx.remarks || '').replace(/,/g, ';')
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `treasury_ledger_${format(new Date(), 'yyyy-MM-dd')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Municipal Financial Ledger</h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              Audit Record
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Immutable transaction history of allocations, disbursements, reversals, and balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download size={14} /> Export CSV
          </button>
          <Link
            href="/treasurer"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            ← Treasurer Dashboard
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
              placeholder="Search by reference, beneficiary, processor, or remarks..."
              className="form-input pl-10 w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Type tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {TX_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-all ${
                  typeFilter === t
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--color-border)] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Calendar size={13} /> Filter Date:
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
              Showing <strong>{filteredTransactions.length}</strong> of <strong>{transactions.length}</strong> transactions
            </span>
            {(search || typeFilter !== 'All' || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(''); setTypeFilter('All'); setDateFrom(''); setDateTo('') }}
                className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
              >
                <X size={12} /> Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Ledger Table ──────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Fund / Assistance</th>
                <th>Beneficiary / Reference</th>
                <th className="text-right">Debit / Credit</th>
                <th className="text-right">Balance After</th>
                <th>Processed By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton h-5 w-full" /></td>)}</tr>
                ))
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    <ScrollText size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-sm">No transactions match your search criteria</p>
                  </td>
                </tr>
              ) : filteredTransactions.map((tx: any) => {
                const isAdd = tx.transaction_type === 'Allocation'
                const isReversal = tx.transaction_type === 'Reversal'

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {format(new Date(tx.created_at), 'MMM d, yyyy • h:mm a')}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isAdd
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                          : isReversal
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                      }`}>
                        {isAdd ? <ArrowUpRight size={12} /> : isReversal ? <RotateCcw size={12} /> : <ArrowDownRight size={12} />}
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="font-semibold text-[var(--color-text)] text-xs">
                      {tx.funds?.assistance_type} Assistance
                    </td>
                    <td>
                      <div className="text-xs font-semibold text-[var(--color-text)]">
                        {tx.requests?.beneficiaries
                          ? `${tx.requests.beneficiaries.first_name} ${tx.requests.beneficiaries.last_name}`
                          : 'Treasury Budget Appropriation'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {tx.remarks || `Ref: #${tx.id.slice(0, 8).toUpperCase()}`}
                      </div>
                    </td>
                    <td className={`text-right font-black text-sm ${isAdd ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      {isAdd ? '+' : '-'}{formatPHP(Number(tx.amount))}
                    </td>
                    <td className="text-right font-bold text-slate-700 dark:text-slate-300 text-xs">
                      {formatPHP(Number(tx.balance_after))}
                    </td>
                    <td className="text-xs text-slate-500">
                      {tx.profiles?.full_name || 'Treasury Officer'}
                    </td>
                    <td>
                      {tx.transaction_type === 'Release' && (
                        <button
                          onClick={() => openReversalModal(tx)}
                          title="Reverse this transaction and restore fund balance"
                          className="px-2 py-1 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors flex items-center gap-1"
                        >
                          <RotateCcw size={11} /> Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Transaction Reversal Modal ────────────────────────────── */}
      {reversalModalOpen && selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--color-border)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-lg font-bold text-red-600 flex items-center gap-1.5">
                  <RotateCcw size={18} /> Reverse Financial Transaction
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">Transaction ID: #{selectedTx.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <button onClick={() => setReversalModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
                <p className="font-bold">Warning: Financial Correction</p>
                <p className="mt-0.5">
                  Reversing this disbursement of <strong>{formatPHP(Number(selectedTx.amount))}</strong> will credit the funds back to the <strong>{selectedTx.funds?.assistance_type}</strong> fund account. The related request will be flagged as reversed.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Mandatory Reversal Justification / Reason *
                </label>
                <textarea
                  className="form-input w-full h-24 text-xs"
                  placeholder="State the official audit reason for reversing this disbursement..."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setReversalModalOpen(false)}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReversal}
                disabled={reversing || !reversalReason.trim()}
                className="btn btn-danger text-sm flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                {reversing ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
