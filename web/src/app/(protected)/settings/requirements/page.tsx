'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ASSISTANCE_TYPES } from '@/lib/constants'
import { Loader2, Plus, Trash2, FileCheck2 } from 'lucide-react'

export default function RequirementsSettingsPage() {
  const supabase = createClient()
  const [requirements, setRequirements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newReq, setNewReq] = useState({ type: 'Medical', name: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('assistance_requirements').select('*').order('assistance_type').order('document_name')
    if (data) setRequirements(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newReq.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('assistance_requirements').insert({
      assistance_type: newReq.type,
      document_name: newReq.name.trim(),
      is_required: true
    })
    if (!error) {
      setNewReq({ ...newReq, name: '' })
      load()
    } else {
      alert(error.message)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this requirement?')) return
    await supabase.from('assistance_requirements').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Requirements Management</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">Manage the required documents for each assistance type.</p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">Add New Requirement</h2>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="form-label">Assistance Type</label>
            <select 
              value={newReq.type} 
              onChange={e => setNewReq({ ...newReq, type: e.target.value })}
              className="form-input"
            >
              {ASSISTANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="form-label">Document Name</label>
            <input 
              type="text" 
              value={newReq.name} 
              onChange={e => setNewReq({ ...newReq, name: e.target.value })}
              placeholder="e.g. Medical Certificate"
              className="form-input"
            />
          </div>
          <button type="submit" disabled={saving || !newReq.name.trim()} className="btn btn-primary whitespace-nowrap">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={18} /> Add Requirement</>}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 size={32} className="animate-spin text-blue-500" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {ASSISTANCE_TYPES.map(type => {
            const reqs = requirements.filter(r => r.assistance_type === type)
            return (
              <div key={type} className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
                    <FileCheck2 size={18} />
                  </div>
                  <h3 className="font-bold text-[var(--color-text)] text-lg">{type}</h3>
                </div>
                
                {reqs.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)] italic">No requirements defined.</p>
                ) : (
                  <ul className="space-y-2">
                    {reqs.map(r => (
                      <li key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)]">
                        <span className="text-sm text-[var(--color-text)] font-medium">{r.document_name}</span>
                        <button 
                          onClick={() => handleDelete(r.id)}
                          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                          title="Remove Requirement"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
