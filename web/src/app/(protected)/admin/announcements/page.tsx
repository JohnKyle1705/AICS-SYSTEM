'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, Plus, Trash2, Edit, Calendar, Info, Loader2, X, Image as ImageIcon } from 'lucide-react'
import { format } from 'date-fns'

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    title: '',
    content: '',
    image_url: '',
    is_published: true
  })

  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    setAnnouncements(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    
    const payload = {
      ...form,
      created_by: user?.id
    }

    let error
    if (editingId) {
      const { error: err } = await supabase
        .from('announcements')
        .update(payload)
        .eq('id', editingId)
      error = err
    } else {
      const { error: err } = await supabase
        .from('announcements')
        .insert([payload])
      error = err
    }

    if (error) {
      alert(error.message)
    } else {
      setModalOpen(false)
      resetForm()
      load()
    }
    setSaving(false)
  }

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return
    
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)
    
    if (error) alert(error.message)
    else load()
  }

  const openEdit = (ann: any) => {
    setEditingId(ann.id)
    setForm({
      title: ann.title,
      content: ann.content,
      image_url: ann.image_url || '',
      is_published: ann.is_published
    })
    setModalOpen(true)
  }

  const resetForm = () => {
    setForm({ title: '', content: '', image_url: '', is_published: true })
    setEditingId(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-500/20">
            <Megaphone size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">Announcements</h1>
            <p className="text-[var(--color-text-secondary)] text-sm">Create and manage system-wide updates</p>
          </div>
        </div>
        <button 
          onClick={() => { resetForm(); setModalOpen(true) }}
          className="btn btn-primary px-5 py-2.5 shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} /> New Announcement
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))
        ) : announcements.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Megaphone size={24} className="text-slate-400" />
            </div>
            <p className="text-[var(--color-text-secondary)]">No announcements yet.</p>
            <button 
              onClick={() => setModalOpen(true)}
              className="text-blue-600 font-bold mt-2"
            >
              Post your first announcement
            </button>
          </div>
        ) : (
          announcements.map(ann => (
            <div key={ann.id} className="card p-5 group hover:border-indigo-300 transition-all">
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-5">
                  {ann.image_url && (
                    <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border)] shadow-sm">
                      <img src={ann.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {!ann.is_published && (
                        <span className="badge bg-slate-100 text-slate-600 text-[10px] py-0.5 px-2">Draft</span>
                      )}
                      <h3 className="font-bold text-lg text-[var(--color-text)]">{ann.title}</h3>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 max-w-2xl">{ann.content}</p>
                    <div className="flex items-center gap-4 pt-1">
                      <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <Calendar size={14} />
                        {format(new Date(ann.created_at), 'MMMM d, yyyy • h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => openEdit(ann)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => deleteAnnouncement(ann.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-xl shadow-2xl p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface)]">
              <h2 className="font-bold text-lg text-[var(--color-text)]">
                {editingId ? 'Edit Announcement' : 'New Announcement'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-[var(--color-surface-hover)] rounded-full transition-colors text-[var(--color-text-secondary)]">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Title</label>
                <input 
                  required
                  className="input"
                  placeholder="What's this announcement about?"
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Content</label>
                <textarea 
                  required
                  rows={6}
                  className="input resize-none py-3"
                  placeholder="Write the full announcement details here..."
                  value={form.content}
                  onChange={e => setForm({...form, content: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Image URL (Optional)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ImageIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                    <input 
                      className="input pl-10"
                      placeholder="https://example.com/image.jpg"
                      value={form.image_url}
                      onChange={e => setForm({...form, image_url: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 py-2">
                <input 
                  type="checkbox" 
                  id="published"
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  checked={form.is_published}
                  onChange={e => setForm({...form, is_published: e.target.checked})}
                />
                <label htmlFor="published" className="text-sm font-medium text-[var(--color-text)]">Publish immediately</label>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setModalOpen(false)}
                  className="btn btn-ghost flex-1 py-3 font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="btn btn-primary flex-1 py-3 font-bold shadow-lg shadow-blue-500/20"
                >
                  {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : editingId ? 'Update' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
