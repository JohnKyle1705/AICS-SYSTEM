'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BARANGAYS, ASSISTANCE_TYPES, ASSISTANCE_COLORS } from '@/lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet, Loader2, TrendingUp, FileText, CheckCircle, XCircle, Clock, EyeOff } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'


const STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  Approved: '#3b82f6',
  Released: '#10b981',
  Declined: '#ef4444',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl px-4 py-3 shadow-xl text-sm">
        {label && <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>}
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-medium">
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function ReportsPage() {
  const { t } = useLanguage()
  const [allData, setAllData] = useState<any[]>([])
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [filters, setFilters] = useState({ from: '', to: '', barangay: '', type: '', status: '' })
  const [includeDeclined, setIncludeDeclined] = useState(false)
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const supabase = createClient()


  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('requests')
      .select('*, beneficiaries(first_name, last_name, barangay, sex, birthdate)')
      .order('created_at', { ascending: false })
    setAllData(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Real-time synchronization when request records change in database
  useEffect(() => {
    const channel = supabase
      .channel('reports_page_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  // Base scoped data matching current filters
  const scopedData = useMemo(() => {
    let result = [...allData]
    if (filters.from) result = result.filter(r => r.created_at >= filters.from)
    if (filters.to) result = result.filter(r => r.created_at <= filters.to + 'T23:59:59')
    if (filters.barangay) result = result.filter(r => r.beneficiaries?.barangay === filters.barangay)
    if (filters.type) result = result.filter(r => r.assistance_type === filters.type)
    if (filters.status) result = result.filter(r => r.status === filters.status)
    return result
  }, [allData, filters])

  useEffect(() => {
    // Breakdown table and charts dataset (respects includeDeclined toggle)
    const result = includeDeclined
      ? scopedData
      : scopedData.filter(r => r.status !== 'Declined')
    setFilteredData(result)
  }, [scopedData, includeDeclined])

  // Compute monthly trend (last 6 months) — always excludes Declined
  useEffect(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      const start = startOfMonth(d).toISOString()
      const end = endOfMonth(d).toISOString()
      const label = format(d, 'MMM yy')
      const base = includeDeclined ? allData : allData.filter(r => r.status !== 'Declined')
      const count = base.filter(r => r.created_at >= start && r.created_at <= end).length
      const approved = base.filter(r => r.created_at >= start && r.created_at <= end && ['Approved', 'Released'].includes(r.status)).length
      return { label, count, approved }

    })
    setMonthlyData(months)
  }, [allData, includeDeclined])

  // Stats — numbers directly match the actual database requests
  const stats = {
    total: scopedData.length,
    pending: scopedData.filter(r => r.status === 'Pending').length,
    approved: scopedData.filter(r => ['Approved', 'Released'].includes(r.status)).length,
    declined: scopedData.filter(r => r.status === 'Declined').length,
    totalAmount: scopedData.reduce((s, r) => s + Number(r.amount_approved || 0), 0),
  }

  // Chart data
  const byType = ASSISTANCE_TYPES.map(t => ({
    name: t, value: filteredData.filter(r => r.assistance_type === t).length
  })).filter(x => x.value > 0)

  const byStatus = Object.entries(STATUS_COLORS).map(([name]) => ({
    name, value: filteredData.filter(r => r.status === name).length
  })).filter(x => x.value > 0)

  const byBarangay = BARANGAYS.map(b => ({
    name: b, count: filteredData.filter(r => r.beneficiaries?.barangay === b).length
  })).filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 10)

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text('AICS Report - Municipality of Daanbantayan', 14, 15)
    doc.setFontSize(10)
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, 14, 22)
    autoTable(doc, {
      startY: 28,
      head: [[t('requests_beneficiary'), t('beneficiary_barangay'), t('requests_type'), t('requests_status'), t('requests_amount'), t('requests_date')]],
      body: filteredData.map((r: any) => [
        `${r.beneficiaries?.last_name}, ${r.beneficiaries?.first_name}`,
        r.beneficiaries?.barangay, r.assistance_type, r.status,
        r.amount_approved ? `₱${Number(r.amount_approved).toLocaleString()}` : '—',
        format(new Date(r.created_at), 'MMM d, yyyy'),
      ]),
    })
    doc.save('AICS_Report.pdf')

  }

  const exportExcel = () => {
    const rows = filteredData.map((r: any) => ({
      [t('requests_beneficiary')]: `${r.beneficiaries?.last_name}, ${r.beneficiaries?.first_name}`,
      [t('beneficiary_barangay')]: r.beneficiaries?.barangay, [t('requests_type')]: r.assistance_type,
      [t('requests_status')]: r.status, [t('newRequest_amountRequested')]: r.amount_requested,
      [t('requests_amount')]: r.amount_approved,
      [t('requests_date')]: format(new Date(r.created_at), 'MMM d, yyyy'),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'AICS Report')
    XLSX.writeFile(wb, 'AICS_Report.xlsx')

  }

  const statCards = [
    { label: t('dashboard_totalRequests'), value: stats.total, icon: FileText, color: '#7c3aed', bg: '#f5f3ff', status: 'All' },
    { label: t('dashboard_approved'), value: stats.approved, icon: CheckCircle, color: '#059669', bg: '#ecfdf5', status: 'Approved' },
    { label: t('dashboard_pending'), value: stats.pending, icon: Clock, color: '#d97706', bg: '#fffbeb', status: 'Pending' },
    { label: t('dashboard_declined'), value: stats.declined, icon: XCircle, color: '#dc2626', bg: '#fef2f2', status: 'Declined' },
  ]


  return (
    <div className="space-y-6" id="reports-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('reports_title')}</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
            {filteredData.length} of {allData.length} records · 
            {includeDeclined 
              ? <span className="text-amber-500 font-medium"> {t('reports_allIncluded')}</span> 
              : <span className="text-emerald-600 font-medium"> {t('reports_declinedExcluded')}</span>}
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={exportPDF} className="btn btn-danger text-sm" id="export-pdf">
            <Download size={15} /> PDF
          </button>
          <button onClick={exportExcel} className="btn btn-success text-sm" id="export-excel">
            <FileSpreadsheet size={15} /> Excel
          </button>
        </div>
      </div>

      {/* Stat Cards - Interactive Navigation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, status }) => (
          <Link
            key={label}
            href={status === 'All' ? '/requests' : `/requests?status=${status}`}
            className="card p-5 flex items-center gap-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500 group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            role="button"
            tabIndex={0}
            title={`View ${label} AICS requests`}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110" style={{ background: bg }}>
              <Icon size={22} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[var(--color-text-secondary)] text-xs font-medium">{label}</p>
              <p className="text-2xl font-bold text-[var(--color-text)] mt-0.5">{value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Total Amount Banner */}
      <div className="card p-5 flex items-center gap-4 bg-linear-to-r from-blue-600 to-violet-600 border-0">
        <TrendingUp size={28} className="text-white/80" />
        <div>
          <p className="text-white/70 text-sm font-medium">{t('reports_totalAmount')}</p>
          <p className="text-3xl font-bold text-white">
            ₱{stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>


      {/* Filters */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3 uppercase tracking-wide">{t('filters')}</p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="form-label">{t('reports_fromDate')}</label>
            <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className="form-input" />
          </div>
          <div>
            <label className="form-label">{t('reports_toDate')}</label>
            <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className="form-input" />
          </div>

          <div>
            <label className="form-label">{t('beneficiary_barangay')}</label>
            <select value={filters.barangay} onChange={e => setFilters(f => ({ ...f, barangay: e.target.value }))} className="form-input">
              <option value="">{t('all')}</option>
              {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">{t('requests_type')}</label>
            <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} className="form-input">
              <option value="">{t('all')}</option>
              {ASSISTANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">{t('requests_status')}</label>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="form-input">
              <option value="">{t('all')}</option>
              {['Pending', 'Approved', 'Released', 'Declined'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

        </div>
        <div className="flex items-center justify-between mt-3">
          <button onClick={() => setFilters({ from: '', to: '', barangay: '', type: '', status: '' })} className="text-[var(--color-primary)] text-xs font-semibold hover:underline">
            {t('clearFilters')}
          </button>

          <button
            onClick={() => setIncludeDeclined(v => !v)}
            id="toggle-declined"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              includeDeclined
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
            }`}
          >
            <EyeOff size={13} />
            {includeDeclined ? t('reports_hidingOff') : t('reports_hidingOn')}
          </button>
        </div>

      </div>

      {loading ? (
        <div className="card p-16 flex items-center justify-center">
          <Loader2 className="animate-spin text-[var(--color-primary)]" size={36} />
        </div>
      ) : (
        <>
          {/* Charts Row 1: Line + Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Line Chart - Monthly Trend */}
            <div className="card p-6 lg:col-span-2">
              <h2 className="font-semibold text-[var(--color-text)] mb-1 text-[15px]">{t('reports_trend')}</h2>
              <p className="text-[var(--color-text-secondary)] text-xs mb-4">{t('reports_trendSubtitle')}</p>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyData} margin={{ right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" name="Total" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
                  <Line type="monotone" dataKey="approved" name="Approved" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart - By Type */}
            <div className="card p-6">
              <h2 className="font-semibold text-[var(--color-text)] mb-1 text-[15px]">{t('reports_byType')}</h2>
              <p className="text-[var(--color-text-secondary)] text-xs mb-4">{t('reports_byTypeSubtitle')}</p>
              {byType.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-[var(--color-text-secondary)] text-sm">{t('noData')}</div>
              ) : (

                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {byType.map(entry => <Cell key={entry.name} fill={(ASSISTANCE_COLORS as any)[entry.name] ?? '#94a3b8'} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Charts Row 2: Donut + Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Donut - By Status */}
            <div className="card p-6">
              <h2 className="font-semibold text-[var(--color-text)] mb-1 text-[15px]">{t('reports_byStatus')}</h2>
              <p className="text-[var(--color-text-secondary)] text-xs mb-4">{t('reports_byStatusSubtitle')}</p>
              {byStatus.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-[var(--color-text-secondary)] text-sm">{t('noData')}</div>
              ) : (

                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={50}>
                      {byStatus.map(entry => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bar Chart - By Barangay */}
            <div className="card p-6 lg:col-span-2">
              <h2 className="font-semibold text-[var(--color-text)] mb-1 text-[15px]">{t('reports_topBarangays')}</h2>
              <p className="text-[var(--color-text-secondary)] text-xs mb-4">{t('reports_topBarangaysSubtitle')}</p>
              {byBarangay.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-[var(--color-text-secondary)] text-sm">{t('noData')}</div>
              ) : (

                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byBarangay} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={72} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Requests" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Data Table (Desktop) */}
          <div className="card overflow-hidden hidden md:block">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="font-semibold text-[var(--color-text)] text-[15px]">{t('reports_records')}</h2>
              <span className="text-xs text-[var(--color-text-secondary)]">{t('reports_showing')} {Math.min(filteredData.length, 50)} {t('reports_of')} {filteredData.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {[t('requests_beneficiary'), t('beneficiary_barangay'), t('requests_type'), t('requests_status'), t('requests_amount'), t('requests_date')].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>

                <tbody>
                  {filteredData.slice(0, 50).map((r: any) => (
                    <tr key={r.id}>
                      <td className="font-medium text-[var(--color-text)]">{r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}</td>
                      <td>{r.beneficiaries?.barangay}</td>
                      <td>
                        <span className="badge" style={{ background: `${(ASSISTANCE_COLORS as any)[r.assistance_type]}20`, color: (ASSISTANCE_COLORS as any)[r.assistance_type] }}>
                          {r.assistance_type}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status] }}>
                          {r.status}
                        </span>
                      </td>
                      <td className="text-[var(--color-text)] font-medium">{r.amount_approved ? `₱${Number(r.amount_approved).toLocaleString()}` : '—'}</td>
                      <td className="text-[var(--color-text-secondary)] text-xs">{format(new Date(r.created_at), 'MMM d, yyyy')}</td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-[var(--color-text-secondary)] py-10">{t('reports_noRecords')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Breakdown Cards */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-semibold text-[var(--color-text)] text-sm">{t('reports_records')}</h2>
              <span className="text-xs text-[var(--color-text-secondary)]">{t('reports_showing')} {Math.min(filteredData.length, 50)} {t('reports_of')} {filteredData.length}</span>
            </div>

            {filteredData.length === 0 ? (
              <div className="card p-6 text-center text-[var(--color-text-secondary)] text-sm">
                {t('reports_noRecords')}
              </div>
            ) : (
              filteredData.slice(0, 50).map((r: any) => (
                <div key={r.id} className="card p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-[var(--color-text)]">
                        {r.beneficiaries?.last_name}, {r.beneficiaries?.first_name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {r.beneficiaries?.barangay ? `Brgy. ${r.beneficiaries?.barangay}` : '—'}
                      </p>
                    </div>
                    <span className="badge" style={{ background: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status] }}>
                      {r.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--color-border)]">
                    <span className="badge" style={{ background: `${(ASSISTANCE_COLORS as any)[r.assistance_type]}20`, color: (ASSISTANCE_COLORS as any)[r.assistance_type] }}>
                      {r.assistance_type}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {r.amount_approved ? `₱${Number(r.amount_approved).toLocaleString()}` : '—'}
                    </span>
                  </div>

                  <div className="text-right text-[11px] text-[var(--color-text-secondary)]">
                    {format(new Date(r.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
