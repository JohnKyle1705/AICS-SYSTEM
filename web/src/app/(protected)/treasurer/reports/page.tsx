'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BARANGAYS, ASSISTANCE_TYPES } from '@/lib/constants'
import {
  BarChart2, Download, FileSpreadsheet, Loader2, Calendar,
  Filter, X, RefreshCw, Printer, Building2, CheckCircle2,
  Wallet, Banknote, ArrowDownRight, ArrowUpRight, ArrowLeft
} from 'lucide-react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function TreasurerReportsPage() {
  const supabase = createClient()
  const [loading, setLoading]           = useState(true)
  const [funds, setFunds]               = useState<any[]>([])
  const [requests, setRequests]         = useState<any[]>([])
  const [payouts, setPayouts]           = useState<any[]>([])
  const [filters, setFilters]           = useState({
    from: '',
    to: '',
    barangay: '',
    type: '',
    paymentMethod: ''
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: fundsData }, { data: reqData }, { data: payoutData }] = await Promise.all([
      supabase.from('funds').select('*').order('assistance_type'),
      supabase.from('requests').select('*, beneficiaries(*)').eq('status', 'Approved').order('created_at', { ascending: false }),
      supabase.from('payouts').select('*, requests(*, beneficiaries(*))').order('created_at', { ascending: false })
    ])

    setFunds(fundsData || [])
    setRequests(reqData || [])
    setPayouts(payoutData || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const formatPHP = (val: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val)

  // Filtered requests (released & pending)
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchType     = filters.type ? r.assistance_type === filters.type : true
      const matchBarangay = filters.barangay ? r.beneficiaries?.barangay === filters.barangay : true
      const matchFrom     = filters.from ? r.created_at >= filters.from : true
      const matchTo       = filters.to ? r.created_at <= filters.to + 'T23:59:59' : true
      const matchMethod   = filters.paymentMethod ? (r.payment_method === filters.paymentMethod || r.extra_fields?.payment_method === filters.paymentMethod) : true
      return matchType && matchBarangay && matchFrom && matchTo && matchMethod
    })
  }, [requests, filters])

  // Released only disbursements for financial reporting
  const releasedDisbursements = useMemo(() => {
    return filteredRequests.filter(r => (r.release_status || 'Pending Release') === 'Released')
  }, [filteredRequests])

  // Barangay aggregation
  const barangayBreakdown = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {}
    releasedDisbursements.forEach(r => {
      const b = r.beneficiaries?.barangay || 'Unassigned'
      if (!map[b]) map[b] = { count: 0, amount: 0 }
      map[b].count += 1
      map[b].amount += Number(r.amount_approved || 0)
    })
    return Object.entries(map).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount)
  }, [releasedDisbursements])

  // Assistance type aggregation
  const assistanceBreakdown = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {}
    releasedDisbursements.forEach(r => {
      const t = r.assistance_type || 'Other'
      if (!map[t]) map[t] = { count: 0, amount: 0 }
      map[t].count += 1
      map[t].amount += Number(r.amount_approved || 0)
    })
    return Object.entries(map).map(([name, data]) => ({ name, ...data }))
  }, [releasedDisbursements])

  const totalDisbursed = releasedDisbursements.reduce((s, r) => s + Number(r.amount_approved || 0), 0)
  const totalAllocated = funds.reduce((s, f) => s + Number(f.total_allocated || 0), 0)
  const totalAvailable = funds.reduce((s, f) => s + Number(f.current_balance || 0), 0)

  /* ── Export to Excel ──────────────────────────────────────────── */
  const exportExcel = () => {
    const summaryRows = [
      { 'Report Title': 'MUNICIPALITY OF DAANBANTAYAN - OFFICE OF THE MUNICIPAL TREASURER' },
      { 'Report Title': 'STATEMENT OF AICS FINANCIAL ASSISTANCE DISBURSEMENTS' },
      { 'Report Title': `Generated On: ${format(new Date(), 'MMMM d, yyyy h:mm a')}` },
      { 'Report Title': '' },
      { 'Report Title': 'SUMMARY TOTALS:' },
      { 'Metric': 'Total Allocated Budget', 'Amount (PHP)': totalAllocated },
      { 'Metric': 'Total Disbursed Assistance', 'Amount (PHP)': totalDisbursed },
      { 'Metric': 'Current Remaining Balance', 'Amount (PHP)': totalAvailable },
      { 'Metric': 'Total Beneficiaries Paid', 'Count': releasedDisbursements.length },
    ]

    const itemRows = releasedDisbursements.map((r, i) => ({
      'Item No.': i + 1,
      'Beneficiary Name': `${r.beneficiaries?.last_name || ''}, ${r.beneficiaries?.first_name || ''}`,
      'Barangay': r.beneficiaries?.barangay || '—',
      'Assistance Type': r.assistance_type,
      'Approved Amount (PHP)': Number(r.amount_approved || 0),
      'Reference #': `#${r.id.slice(0, 8).toUpperCase()}`,
      'Date Released': format(new Date(r.updated_at || r.created_at), 'yyyy-MM-dd'),
      'Disbursing Officer': r.disbursing_officer || 'Municipal Administration'
    }))

    const wb = XLSX.utils.book_new()
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    const wsItems = XLSX.utils.json_to_sheet(itemRows)

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Financial Summary')
    XLSX.utils.book_append_sheet(wb, wsItems, 'Disbursement List')
    XLSX.writeFile(wb, `AICS_Treasurer_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`)
  }

  /* ── Export to Printable PDF with Official Treasury Header ────── */
  const exportPDF = () => {
    const doc = new jsPDF()

    // Official Municipal Treasury Header
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Republic of the Philippines', 105, 12, { align: 'center' })
    doc.text('Province of Cebu', 105, 16, { align: 'center' })
    doc.text('MUNICIPALITY OF DAANBANTAYAN', 105, 20, { align: 'center' })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('OFFICE OF THE MUNICIPAL TREASURER', 105, 26, { align: 'center' })

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('STATEMENT OF AICS ASSISTANCE DISBURSEMENTS & FUND UTILIZATION', 105, 31, { align: 'center' })

    doc.setLineWidth(0.5)
    doc.line(14, 34, 196, 34)

    // Meta details
    doc.setFontSize(8)
    doc.text(`Reporting Period: ${filters.from || 'All dates'} to ${filters.to || 'Present'}`, 14, 39)
    doc.text(`Generated Date: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, 14, 43)

    // Financial KPI Summary Table
    autoTable(doc, {
      startY: 46,
      head: [['Assistance Fund Category', 'Total Allocated Budget', 'Total Disbursed', 'Remaining Balance', 'Utilization']],
      body: funds.map(f => {
        const util = f.total_allocated > 0 ? Math.round((Number(f.total_released) / Number(f.total_allocated)) * 100) : 0
        return [
          `${f.assistance_type} Assistance`,
          `PHP ${Number(f.total_allocated).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `PHP ${Number(f.total_released).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `PHP ${Number(f.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `${util}%`
        ]
      }),
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
    })

    const finalY = (doc as any).lastAutoTable?.finalY || 80

    // Beneficiary Disbursements Table
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('RECORD OF DISBURSEMENTS TO BENEFICIARIES', 14, finalY + 8)

    autoTable(doc, {
      startY: finalY + 11,
      head: [['Reference #', 'Beneficiary Name', 'Barangay', 'Assistance', 'Amount (PHP)', 'Date Released']],
      body: releasedDisbursements.map(r => [
        `#${r.id.slice(0, 8).toUpperCase()}`,
        `${r.beneficiaries?.last_name || ''}, ${r.beneficiaries?.first_name || ''}`,
        r.beneficiaries?.barangay || '—',
        r.assistance_type,
        `PHP ${Number(r.amount_approved || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        format(new Date(r.updated_at || r.created_at), 'yyyy-MM-dd')
      ]),
      theme: 'striped',
      headStyles: { fillColor: [40, 50, 70], textColor: 255, fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 1.8 },
    })

    const sigY = (doc as any).lastAutoTable?.finalY + 18 || 220
    if (sigY < 265) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Prepared & Certified Correct:', 14, sigY)
      doc.line(14, sigY + 14, 75, sigY + 14)
      doc.setFont('helvetica', 'bold')
      doc.text('CHANIMAE MONTESCLAROS', 14, sigY + 18)
      doc.setFont('helvetica', 'normal')
      doc.text('Municipal Treasurer', 14, sigY + 22)

      doc.text('Noted by:', 130, sigY)
      doc.line(130, sigY + 14, 190, sigY + 14)
      doc.setFont('helvetica', 'bold')
      doc.text('HON. MUNICIPAL MAYOR', 130, sigY + 18)
      doc.setFont('helvetica', 'normal')
      doc.text('Municipality of Daanbantayan', 130, sigY + 22)
    }

    doc.save(`AICS_Treasury_Report_${format(new Date(), 'yyyyMMdd')}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* ── Official Treasury Header ──────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-[var(--color-border)] shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Republic of the Philippines · Province of Cebu</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              MUNICIPALITY OF DAANBANTAYAN · OFFICE OF THE MUNICIPAL TREASURER
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] font-medium">
              Official Comprehensive Financial Statements, Appropriations & Expenditure Reports
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={exportPDF}
              className="btn btn-primary text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Printer size={14} /> Printable PDF Report
            </button>
            <button
              onClick={exportExcel}
              className="btn btn-success text-xs flex items-center gap-1.5 shadow-sm"
            >
              <FileSpreadsheet size={14} /> Export to Excel
            </button>
            <Link
              href="/treasurer"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* ── Filter Strip ──────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="font-semibold text-slate-500 block mb-1">From Date</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
              className="form-input text-xs w-full"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-500 block mb-1">To Date</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
              className="form-input text-xs w-full"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-500 block mb-1">Assistance Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
              className="form-input text-xs w-full"
            >
              <option value="">All Types</option>
              {ASSISTANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-500 block mb-1">Barangay</label>
            <select
              value={filters.barangay}
              onChange={(e) => setFilters(f => ({ ...f, barangay: e.target.value }))}
              className="form-input text-xs w-full"
            >
              <option value="">All Barangays</option>
              {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-500 block mb-1">Payment Method</label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters(f => ({ ...f, paymentMethod: e.target.value }))}
              className="form-input text-xs w-full"
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Digital Wallet">Digital Wallet</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--color-border)]">
          <span className="text-slate-500 font-medium">
            Filtering <strong>{releasedDisbursements.length}</strong> disbursed records (Total: <strong>{formatPHP(totalDisbursed)}</strong>)
          </span>
          {(filters.from || filters.to || filters.type || filters.barangay || filters.paymentMethod) && (
            <button
              onClick={() => setFilters({ from: '', to: '', type: '', barangay: '', paymentMethod: '' })}
              className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              <X size={12} /> Clear Filter Parameters
            </button>
          )}
        </div>
      </div>

      {/* ── Summary Financial Cards ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-blue-500">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total Budget Allocated</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{formatPHP(totalAllocated)}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Full Municipal AICS Appropriation</span>
        </div>

        <div className="card p-5 border-l-4 border-orange-500">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total Assistance Disbursed</span>
          <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1">{formatPHP(totalDisbursed)}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Filtered Disbursement Total</span>
        </div>

        <div className="card p-5 border-l-4 border-emerald-500">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Treasury Available Balance</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatPHP(totalAvailable)}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Current Municipal Treasury Reserve</span>
        </div>
      </div>

      {/* ── Breakdown Tables (Assistance & Barangay) ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assistance Type Distribution */}
        <div className="card p-5">
          <h2 className="font-bold text-sm text-[var(--color-text)] mb-3 flex items-center gap-2">
            <Banknote size={16} className="text-blue-500" /> Expenditures by Assistance Type
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-slate-400 uppercase">
                  <th className="pb-2 font-semibold">Type</th>
                  <th className="pb-2 font-semibold text-center">Beneficiaries Paid</th>
                  <th className="pb-2 font-semibold text-right">Total Released</th>
                  <th className="pb-2 font-semibold text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {assistanceBreakdown.length === 0 ? (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">No disbursements recorded.</td></tr>
                ) : assistanceBreakdown.map(item => {
                  const pct = totalDisbursed > 0 ? Math.round((item.amount / totalDisbursed) * 100) : 0
                  return (
                    <tr key={item.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 font-bold text-[var(--color-text)]">{item.name}</td>
                      <td className="py-2.5 text-center font-semibold text-slate-600 dark:text-slate-300">{item.count}</td>
                      <td className="py-2.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400">{formatPHP(item.amount)}</td>
                      <td className="py-2.5 text-right font-medium text-slate-500">{pct}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Barangay Distribution */}
        <div className="card p-5">
          <h2 className="font-bold text-sm text-[var(--color-text)] mb-3 flex items-center gap-2">
            <Building2 size={16} className="text-indigo-500" /> Barangay-Level Financial Distribution
          </h2>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-slate-400 uppercase sticky top-0 bg-white dark:bg-slate-900">
                  <th className="pb-2 font-semibold">Barangay</th>
                  <th className="pb-2 font-semibold text-center">Beneficiaries</th>
                  <th className="pb-2 font-semibold text-right">Total Disbursed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {barangayBreakdown.length === 0 ? (
                  <tr><td colSpan={3} className="py-4 text-center text-slate-400">No records found.</td></tr>
                ) : barangayBreakdown.map(b => (
                  <tr key={b.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2 font-semibold text-[var(--color-text)]">{b.name}</td>
                    <td className="py-2 text-center text-slate-600 dark:text-slate-300">{b.count}</td>
                    <td className="py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatPHP(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Detailed Beneficiary Disbursement Ledger ──────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-sm text-[var(--color-text)]">
              Beneficiary Financial Assistance Disbursement List
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Official records of assistance disbursed to beneficiaries with release logs.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {releasedDisbursements.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Reference #</th>
                <th>Beneficiary Name</th>
                <th>Barangay</th>
                <th>Assistance Type</th>
                <th>Amount Released</th>
                <th>Release Date</th>
                <th>Disbursing Officer</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="skeleton h-5 w-full" /></td>)}</tr>
                ))
              ) : releasedDisbursements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No released assistance records match the specified filters.
                  </td>
                </tr>
              ) : releasedDisbursements.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                    #{r.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="font-bold text-[var(--color-text)]">
                    {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
                  </td>
                  <td className="text-slate-600 dark:text-slate-300">
                    {r.beneficiaries?.barangay || '—'}
                  </td>
                  <td>
                    <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs">
                      {r.assistance_type}
                    </span>
                  </td>
                  <td className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatPHP(Number(r.amount_approved || 0))}
                  </td>
                  <td className="text-slate-500">
                    {format(new Date(r.updated_at || r.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="text-slate-600 dark:text-slate-300">
                    {r.disbursing_officer || 'Municipal Administration'}
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
