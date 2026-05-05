'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Shield, Save, Loader2, Camera, Trash2, MessageSquare, Heart, Send, AlertCircle, Star, FileText } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'

type TabType = 'profile' | 'support' | 'feedback' | 'requirements'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [profile, setProfile] = useState<any>(null)
  const [beneficiary, setBeneficiary] = useState<any>(null)
  
  // Admin Requirements state
  const [requirements, setRequirements] = useState<any[]>([])
  const [reqTypeFilter, setReqTypeFilter] = useState('Medical')
  const [newReqName, setNewReqName] = useState('')
  const [newReqRequired, setNewReqRequired] = useState(true)
  
  // Forms state
  const [supportForm, setSupportForm] = useState({ concern_type: 'General Inquiry', message: '' })
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comments: '' })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const supabase = createClient()
  const { t } = useLanguage()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile({ ...data, email: user.email })
        
        if (data?.role === 'resident') {
          const { data: ben } = await supabase.from('beneficiaries').select('*').eq('created_by', user.id).single()
          if (ben) {
            setBeneficiary(ben)
          } else {
            // Initialize empty beneficiary if none exists
            setBeneficiary({
              first_name: data.full_name?.split(' ')[0] || '',
              last_name: data.full_name?.split(' ').slice(1).join(' ') || '',
              address: '',
              contact_number: '',
              birthdate: '',
              civil_status: 'Single',
              occupation: '',
              barangay: '',
              sex: 'Male'
            })
          }
        }
        if (data?.role === 'admin' || data?.role === 'staff') {
          const { data: reqs } = await supabase.from('assistance_requirements').select('*').order('created_at', { ascending: true })
          if (reqs) setRequirements(reqs)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const loadRequirements = async () => {
    const { data: reqs } = await supabase.from('assistance_requirements').select('*').order('created_at', { ascending: true })
    if (reqs) setRequirements(reqs)
  }

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newReqName.trim()) return
    setSaving(true)
    const { error } = await supabase.from('assistance_requirements').insert({
      assistance_type: reqTypeFilter,
      document_name: newReqName,
      is_required: newReqRequired
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Requirement added successfully!' })
      setNewReqName('')
      await loadRequirements()
    }
    setSaving(false)
  }

  const handleToggleRequirement = async (id: string, currentVal: boolean) => {
    const { error } = await supabase.from('assistance_requirements').update({ is_required: !currentVal }).eq('id', id)
    if (!error) await loadRequirements()
  }

  const handleDeleteRequirement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this requirement?')) return
    const { error } = await supabase.from('assistance_requirements').delete().eq('id', id)
    if (!error) await loadRequirements()
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage({ type: 'error', text: 'Authentication error. Please sign in again.' })
      setSaving(false)
      return
    }

    // Save profile
    const { error: profileError } = await supabase.from('profiles')
      .update({ 
        full_name: profile.full_name,
        avatar_url: profile.avatar_url 
      })
      .eq('id', user.id)

    if (profileError) {
      setMessage({ type: 'error', text: profileError.message })
      setSaving(false)
      return
    }

    // Save beneficiary details if resident
    if (profile.role === 'resident' && beneficiary) {
      if (!beneficiary.birthdate || !beneficiary.address || !beneficiary.contact_number) {
         setMessage({ type: 'error', text: 'Please complete all required personal information fields.' })
         setSaving(false)
         return
      }

      const benPayload = {
        first_name: profile.full_name?.split(' ')[0] || beneficiary.first_name,
        last_name: profile.full_name?.split(' ').slice(1).join(' ') || beneficiary.last_name,
        address: beneficiary.address,
        contact_number: beneficiary.contact_number,
        birthdate: beneficiary.birthdate,
        civil_status: beneficiary.civil_status,
        occupation: beneficiary.occupation,
        barangay: beneficiary.barangay,
        sex: beneficiary.sex,
        created_by: user.id
      }

      let benError
      if (beneficiary.id) {
        const res = await supabase.from('beneficiaries').update(benPayload).eq('id', beneficiary.id)
        benError = res.error
      } else {
        const res = await supabase.from('beneficiaries').insert(benPayload).select().single()
        benError = res.error
        if (res.data) setBeneficiary(res.data)
      }

      if (benError) {
        setMessage({ type: 'error', text: 'Error saving personal info: ' + benError.message })
        setSaving(false)
        return
      }
    }

    setMessage({ type: 'success', text: 'Profile updated successfully!' })
    setSaving(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 2MB' })
      return
    }

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setMessage({ type: 'error', text: 'Only JPG and PNG are supported' })
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Math.random()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      setMessage({ type: 'error', text: 'Error uploading image: ' + uploadError.message })
      setSaving(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
    
    setProfile({ ...profile, avatar_url: publicUrl })
    
    const { error: updateError } = await supabase.from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    if (updateError) {
      setMessage({ type: 'error', text: 'Error updating profile: ' + updateError.message })
    } else {
      setMessage({ type: 'success', text: 'Profile picture updated!' })
    }
    setSaving(false)
  }

  const removeAvatar = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id)

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setProfile({ ...profile, avatar_url: null })
      setMessage({ type: 'success', text: 'Profile picture removed' })
    }
    setSaving(false)
  }

  const handleSubmitSupport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supportForm.message.trim()) return

    setSaving(true)
    setMessage({ type: '', text: '' })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      concern_type: supportForm.concern_type,
      message: supportForm.message
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Support ticket submitted successfully!' })
      setSupportForm({ ...supportForm, message: '' })
    }
    setSaving(false)
  }

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('feedbacks').insert({
      user_id: user.id,
      rating: feedbackForm.rating,
      comments: feedbackForm.comments
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Thank you for your feedback!' })
      setFeedbackForm({ rating: 5, comments: '' })
    }
    setSaving(false)
  }

  if (loading) return <div className="skeleton h-64 rounded-2xl" />

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('settings_title')}</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">{t('settings_subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] mb-6 overflow-x-auto no-scrollbar">
        {[
          { id: 'profile', icon: User, label: t('settings_profileInfo') },
          ...(profile?.role === 'admin' || profile?.role === 'staff' ? [{ id: 'requirements', icon: FileText, label: t('settings_requirementsSetup') }] : []),
          { id: 'support', icon: MessageSquare, label: t('settings_contactSupport') },
          { id: 'feedback', icon: Heart, label: t('settings_feedback') }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as TabType); setMessage({ type: '', text: '' }) }}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === tab.id 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30' : 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30'}`}>
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{message.text}</p>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card p-8">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="flex items-center gap-6 mb-8 pb-8 border-b border-[var(--color-border)]">
              <div className="relative group">
                <div className="w-24 h-24 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-500/20 overflow-hidden shadow-inner">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={40} className="opacity-50" />
                  )}
                  {saving && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 size={24} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95 border-2 border-white dark:border-slate-900">
                  <Camera size={14} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={saving} />
                </label>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-[var(--color-text)]">{profile?.full_name}</h3>
                <p className="text-[var(--color-text-secondary)] text-sm capitalize mb-2">{profile?.role}</p>
                {profile?.avatar_url && (
                  <button type="button" onClick={removeAvatar} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium transition-colors">
                    <Trash2 size={12} /> {t('settings_removePhoto')}
                  </button>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">{t('settings_accountDetails')}</h4>
              </div>
              
              <div>
                <label className="form-label">{t('settings_emailAddress')}</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" value={profile?.email || ''} disabled className="form-input pl-10 opacity-60 cursor-not-allowed" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 ml-1">{t('settings_emailCannotChange')}</p>
              </div>

              <div>
                <label className="form-label">{t('settings_fullName')}</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={profile?.full_name || ''} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="form-input pl-10" required />
                </div>
              </div>

              {profile?.role === 'resident' && beneficiary && (
                <>
                  <div className="md:col-span-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                    <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">{t('settings_personalInfo')}</h4>
                  </div>

                  <div>
                    <label className="form-label">{t('settings_dateOfBirth')}</label>
                    <input type="date" value={beneficiary.birthdate || ''} onChange={(e) => setBeneficiary({ ...beneficiary, birthdate: e.target.value })} className="form-input" required />
                  </div>

                  <div>
                    <label className="form-label">{t('settings_civilStatus')}</label>
                    <select value={beneficiary.civil_status || 'Single'} onChange={(e) => setBeneficiary({ ...beneficiary, civil_status: e.target.value })} className="form-input" required>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                      <option value="Annulled">Annulled</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">{t('settings_contactNumber')}</label>
                    <input type="tel" value={beneficiary.contact_number || ''} onChange={(e) => setBeneficiary({ ...beneficiary, contact_number: e.target.value })} className="form-input" placeholder="e.g. 09123456789" required />
                  </div>

                  <div>
                    <label className="form-label">{t('settings_occupation')}</label>
                    <input type="text" value={beneficiary.occupation || ''} onChange={(e) => setBeneficiary({ ...beneficiary, occupation: e.target.value })} className="form-input" placeholder="e.g. Farmer, Vendor" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="form-label">{t('settings_completeAddress')}</label>
                    <textarea value={beneficiary.address || ''} onChange={(e) => setBeneficiary({ ...beneficiary, address: e.target.value })} className="form-input min-h-[80px]" placeholder="Street name, house number..." required />
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={saving} className="btn btn-primary px-8">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> {t('settings_saveChanges')}</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requirements Setup Tab (Admin/Staff) */}
      {activeTab === 'requirements' && (profile?.role === 'admin' || profile?.role === 'staff') && (
        <div className="card p-8">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[var(--color-text)]">{t('req_manageRequirements')}</h3>
            <p className="text-[var(--color-text-secondary)] text-sm">{t('req_configureDocuments')}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6 pb-6 border-b border-[var(--color-border)]">
            <div className="flex-1">
              <label className="form-label">{t('req_assistanceType')}</label>
              <select value={reqTypeFilter} onChange={e => setReqTypeFilter(e.target.value)} className="form-input">
                <option value="Medical">Medical</option>
                <option value="Burial">Burial</option>
                <option value="Educational">Educational</option>
                <option value="Foods">Foods</option>
              </select>
            </div>
          </div>

          {/* Add New Form */}
          <form onSubmit={handleAddRequirement} className="bg-[var(--color-surface-hover)] p-4 rounded-xl border border-[var(--color-border)] mb-6 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="form-label">{t('req_newDocumentName')}</label>
              <input type="text" value={newReqName} onChange={e => setNewReqName(e.target.value)} className="form-input" placeholder="e.g. Barangay Clearance" required />
            </div>
            <div className="w-full sm:w-auto">
              <label className="form-label">{t('req_type')}</label>
              <select value={newReqRequired ? 'true' : 'false'} onChange={e => setNewReqRequired(e.target.value === 'true')} className="form-input">
                <option value="true">{t('req_required')}</option>
                <option value="false">{t('req_optional')}</option>
              </select>
            </div>
            <button type="submit" disabled={saving || !newReqName.trim()} className="btn btn-primary w-full sm:w-auto mt-2 sm:mt-0 whitespace-nowrap">
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
            </button>
          </form>

          {/* Requirements List */}
          <div className="space-y-3">
            {requirements.filter(r => r.assistance_type === reqTypeFilter).length === 0 ? (
              <p className="text-center text-[var(--color-text-secondary)] py-6 italic text-sm">{t('req_noRequirements')}</p>
            ) : (
              requirements.filter(r => r.assistance_type === reqTypeFilter).map((req) => (
                <div key={req.id} className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] hover:border-blue-500/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-blue-500" />
                    <div>
                      <p className="font-semibold text-[var(--color-text)] text-sm">{req.document_name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${req.is_required ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {req.is_required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleToggleRequirement(req.id, req.is_required)} className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded dark:hover:bg-blue-900/20 font-medium">
                      {t('req_toggleType')}
                    </button>
                    <button type="button" onClick={() => handleDeleteRequirement(req.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded dark:hover:bg-red-900/20">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Support Tab */}
      {activeTab === 'support' && (
        <div className="card p-8">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[var(--color-text)]">{t('support_title')}</h3>
            <p className="text-[var(--color-text-secondary)] text-sm">{t('support_subtitle')}</p>
          </div>

          <form onSubmit={handleSubmitSupport} className="space-y-5">
            <div>
              <label className="form-label">{t('support_concernType')}</label>
              <select 
                value={supportForm.concern_type} 
                onChange={(e) => setSupportForm({...supportForm, concern_type: e.target.value})}
                className="form-input"
                required
              >
                <option value="General Inquiry">{t('support_generalInquiry')}</option>
                <option value="Technical Issue">{t('support_technicalIssue')}</option>
                <option value="Request Follow-up">{t('support_requestFollowUp')}</option>
              </select>
            </div>

            <div>
              <label className="form-label">{t('support_message')}</label>
              <textarea 
                value={supportForm.message} 
                onChange={(e) => setSupportForm({...supportForm, message: e.target.value})}
                className="form-input min-h-[120px]" 
                placeholder="Describe your concern in detail..."
                required 
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={saving || !supportForm.message.trim()} className="btn btn-primary px-8">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> {t('support_submitTicket')}</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div className="card p-8">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[var(--color-text)]">{t('feedback_title')}</h3>
            <p className="text-[var(--color-text-secondary)] text-sm">{t('feedback_subtitle')}</p>
          </div>

          <form onSubmit={handleSubmitFeedback} className="space-y-6">
            <div>
              <label className="form-label text-center block mb-4 text-base">{t('feedback_rateExperience')}</label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackForm({...feedbackForm, rating: star})}
                    className="p-2 transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star 
                      size={36} 
                      className={star <= feedbackForm.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 dark:text-slate-600'} 
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">{t('feedback_commentsLabel')}</label>
              <textarea 
                value={feedbackForm.comments} 
                onChange={(e) => setFeedbackForm({...feedbackForm, comments: e.target.value})}
                className="form-input min-h-[120px]" 
                placeholder="What did you like? What can we improve?"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={saving} className="btn btn-primary px-8">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <><Heart size={18} /> {t('feedback_submit')}</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
