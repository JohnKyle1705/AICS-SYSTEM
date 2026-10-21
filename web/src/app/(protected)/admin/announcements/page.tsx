'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, Plus, Trash2, Edit, Calendar, Loader2, X, Image as ImageIcon, Upload } from 'lucide-react'
import NextImage from 'next/image'
import { format } from 'date-fns'

export default function AdminAnnouncements() {
  type Announcement = { id: string; title: string; content: string; image_url?: string; is_published: boolean; created_at: string }
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [form, setForm] = useState({
    title: '',
    content: '',
    image_url: '',
    is_published: true
  })

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    setAnnouncements(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    setMounted(true)
    load()
  }, [load])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return
      const file = e.target.files[0]
      setUploadingImage(true)
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('announcements')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('announcements')
        .getPublicUrl(filePath)
        
      setForm({ ...form, image_url: publicUrl })
    } catch (error: unknown) {
      alert('Error uploading image: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    
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

  const openEdit = (ann: Announcement) => {
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

  const modalElement = modalOpen ? (
    <div 
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 backdrop-blur-sm p-3 sm:p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) setModalOpen(false)
      }}
    >
      <div className="min-h-full flex items-center justify-center py-4 sm:py-6">
        <div 
          className="card w-full max-w-xl shadow-2xl p-0 overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col my-auto border border-[var(--color-border)] bg-[var(--color-surface)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Fixed/Sticky at top of modal */}
          <div className="px-5 sm:px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface)] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <Megaphone size={16} />
              </div>
              <h2 className="font-bold text-base sm:text-lg text-[var(--color-text)]">
                {editingId ? 'Edit Announcement' : 'New Announcement'}
              </h2>
            </div>
            <button 
              type="button"
              onClick={() => setModalOpen(false)} 
              className="p-1.5 hover:bg-[var(--color-surface-hover)] rounded-full transition-colors text-[var(--color-text-secondary)]"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Scrollable Form Body */}
          <form id="announcement-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* TITLE FIELD - Prominently placed at the top */}
            <div className="space-y-1.5">
              <label htmlFor="announcement-title" className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1">
                Title <span className="text-rose-500">*</span>
              </label>
              <input 
                id="announcement-title"
                required
                autoFocus
                type="text"
                className="input w-full font-semibold"
                placeholder="What's this announcement about?"
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>

            {/* CONTENT FIELD */}
            <div className="space-y-1.5">
              <label htmlFor="announcement-content" className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1">
                Content <span className="text-rose-500">*</span>
              </label>
              <textarea 
                id="announcement-content"
                required
                rows={4}
                className="input resize-none py-3 text-sm leading-relaxed"
                placeholder="Write the full announcement details here..."
                value={form.content}
                onChange={e => setForm({...form, content: e.target.value})}
              />
            </div>

            {/* ANNOUNCEMENT IMAGE (OPTIONAL) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Announcement Image (Optional)
              </label>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="relative flex-1">
                  <ImageIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                  <input 
                    type="url"
                    className="input pl-10 text-xs sm:text-sm w-full"
                    placeholder="https://example.com/image.jpg"
                    value={form.image_url}
                    onChange={e => setForm({...form, image_url: e.target.value})}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-secondary)] font-medium hidden sm:inline">OR</span>
                  <label className="btn bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer px-4 py-2.5 flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-initial">
                    {uploadingImage ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <Upload size={16} />}
                    <span className="text-xs sm:text-sm font-bold">{uploadingImage ? 'Uploading...' : 'Upload'}</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden" 
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </label>
                </div>
              </div>

              {/* Image Preview */}
              {form.image_url && (
                <div className="mt-2 relative rounded-xl overflow-hidden border border-[var(--color-border)] max-h-36 bg-slate-900/40">
                  <NextImage
                    src={form.image_url}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, image_url: '' })}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                    title="Remove image"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* PUBLISH STATUS */}
            <div className="flex items-center gap-3 py-1">
              <input 
                type="checkbox" 
                id="published"
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                checked={form.is_published}
                onChange={e => setForm({...form, is_published: e.target.checked})}
              />
              <label htmlFor="published" className="text-sm font-medium text-[var(--color-text)] cursor-pointer">
                Publish immediately
              </label>
            </div>
          </form>

          {/* Sticky Footer */}
          <div className="px-5 sm:px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex gap-3 shrink-0">
            <button 
              type="button" 
              onClick={() => setModalOpen(false)}
              className="btn btn-ghost flex-1 py-2.5 font-bold text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              form="announcement-form"
              disabled={saving || uploadingImage}
              className="btn btn-primary flex-1 py-2.5 font-bold text-sm shadow-lg shadow-blue-500/20"
            >
              {saving ? <><Loader2 size={16} className="animate-spin mr-1" /> Saving...</> : editingId ? 'Update' : 'Post Announcement'}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          className="btn btn-primary px-5 py-2.5 shadow-lg shadow-blue-500/20 w-full sm:w-auto flex items-center justify-center gap-2"
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
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 w-full sm:w-auto flex-1 min-w-0">
                  {ann.image_url && (
                    <div className="w-full sm:w-24 h-40 sm:h-24 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border)] shadow-sm">
                      <NextImage
                        src={ann.image_url ?? ''}
                        alt={ann.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!ann.is_published && (
                        <span className="badge bg-slate-100 text-slate-600 text-[10px] py-0.5 px-2">Draft</span>
                      )}
                      <h3 className="font-bold text-base sm:text-lg text-[var(--color-text)] break-words">{ann.title}</h3>
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
                <div className="flex gap-2 self-end sm:self-start opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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

      {/* Render modal directly in document.body to ensure it renders above mobile headers and is never clipped */}
      {mounted && modalElement && createPortal(modalElement, document.body)}
    </div>
  )
}

