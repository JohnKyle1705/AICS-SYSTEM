'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Beneficiary } from '@/types'
import { BARANGAYS } from '@/lib/constants'
import { Search, Plus, Pencil, Trash2, Users } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'


export default function BeneficiariesPage() {
  const { t } = useLanguage()
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [search, setSearch] = useState('')
  const [barangay, setBarangay] = useState('')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('beneficiaries').select('*').order('last_name')
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
    if (barangay) query = query.eq('barangay', barangay)
    const { data } = await query
    setBeneficiaries(data ?? [])
    setLoading(false)
  }, [search, barangay])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm(t('ben_deleteMsg'))) return

    await supabase.from('beneficiaries').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-5" id="beneficiaries-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('nav_beneficiaries')}</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">{beneficiaries.length} {t('noData').toLowerCase() !== 'no data found' ? t('dashboard_registeredBeneficiaries') : 'records found'}</p>
        </div>
        <Link href="/beneficiaries/new" className="btn btn-primary" id="add-beneficiary-btn">
          <Plus size={16} /> {t('ben_addBeneficiary')}
        </Link>

      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('ben_searchPlaceholder')}
            className="form-input pl-10"
            id="beneficiary-search"
          />

        </div>
        <select
          value={barangay}
          onChange={(e) => setBarangay(e.target.value)}
          className="form-input w-auto min-w-[180px]"
          id="barangay-filter"
        >
          <option value="">{t('all')} Barangays</option>
          {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}

        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" id="beneficiaries-table">
            <thead>
              <tr>
                {[t('ben_name'), t('settings_sex').replace(' *',''), t('ben_barangay'), t('ben_contact'), 'Tags', t('actions')].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j}><div className="skeleton h-5 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : beneficiaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Users size={36} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{t('noData')}</p>
                  </td>

                </tr>
              ) : beneficiaries.map((b) => (
                <tr key={b.id}>
                  <td className="font-medium text-[var(--color-text)]">
                    {b.last_name}, {b.first_name} {b.middle_name ?? ''} {b.suffix ?? ''}
                  </td>
                  <td>{b.sex}</td>
                  <td>{b.barangay}</td>
                  <td>{b.contact_number ?? '—'}</td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {b.is_pwd && <span className="badge" style={{ background: '#f3e8ff', color: '#7c3aed' }}>PWD</span>}
                      {b.is_senior && <span className="badge" style={{ background: '#fff7ed', color: '#c2410c' }}>Senior</span>}
                      {b.is_4ps && <span className="badge" style={{ background: '#ecfdf5', color: '#059669' }}>4Ps</span>}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link href={`/beneficiaries/${b.id}/edit`}
                        className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded hover:bg-blue-50">
                        <Pencil size={15} />
                      </Link>
                      <button onClick={() => handleDelete(b.id)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50">
                        <Trash2 size={15} />
                      </button>
                    </div>
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
