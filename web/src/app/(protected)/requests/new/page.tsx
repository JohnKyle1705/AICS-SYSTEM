'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ASSISTANCE_TYPES } from '@/lib/constants'
import {
  Loader2, Check, X, FileText, AlertCircle, ChevronRight,
  ChevronLeft, GraduationCap, Stethoscope, UtensilsCrossed, Cross,
  Camera, RotateCcw, User, CreditCard, Upload, ShieldAlert, MapPin, Phone
} from 'lucide-react'
import Link from 'next/link'
import { BARANGAYS } from '@/lib/constants'
import CameraModal from '@/components/CameraModal'
import { useLanguage } from '@/lib/LanguageContext'

// ── Per-type field configurations ──────────────────────────────


const TYPE_ICONS: Record<string, any> = {
  Medical: Stethoscope,
  Burial: Cross,
}

const AMOUNT_RANGES: Record<string, string[]> = {
  Medical: ['₱1,000 - ₱3,000', '₱3,001 - ₱5,000', '₱5,001 - ₱10,000'],
  Burial: ['₱5,000 - ₱10,000', '₱10,001+']
}

export default function NewRequestPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLanguage()
  
  // ── Per-type field configurations ──────────────────────────────
  const TYPE_FIELDS: Record<string, { key: string; label: string; type: string; placeholder: string; required?: boolean }[]> = {
    Medical: [
      { key: 'hospital_name', label: t('newRequest_fields.hospital_name'), type: 'text', placeholder: t('newRequest_placeholders.hospital_name'), required: true },
      { key: 'diagnosis', label: t('newRequest_fields.diagnosis'), type: 'text', placeholder: t('newRequest_placeholders.diagnosis'), required: true },
      { key: 'estimated_cost', label: t('newRequest_fields.estimated_cost'), type: 'number', placeholder: '0.00', required: true },
    ],
    Burial: [
      { key: 'deceased_name', label: t('newRequest_fields.deceased_name'), type: 'text', placeholder: t('newRequest_placeholders.deceased_name'), required: true },
      { key: 'relationship', label: t('newRequest_fields.relationship'), type: 'text', placeholder: t('newRequest_placeholders.relationship'), required: true },
      { key: 'funeral_home', label: t('newRequest_fields.funeral_home'), type: 'text', placeholder: t('newRequest_placeholders.funeral_home'), required: true },
    ],
  }

  // ── State ────────────────────────────────────────────────────
  const [step, setStep] = useState(1)
  const [myBeneficiary, setMyBeneficiary] = useState<any>(null)
  const [requirements, setRequirements] = useState<any[]>([])
  const [preparedDocs, setPreparedDocs] = useState<Record<string, boolean>>({})
  const [validIdFront, setValidIdFront] = useState<File | null>(null)
  const [validIdBack, setValidIdBack] = useState<File | null>(null)
  const [cameraOpen, setCameraOpen] = useState<'front' | 'back' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Duplicate Prevention States
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState('')
  const [recentRequests, setRecentRequests] = useState<any[]>([])
  const [restrictionDays, setRestrictionDays] = useState(30)

  // Registration gate states
  const [isUnregistered, setIsUnregistered] = useState(false)
  const [loadingCheck, setLoadingCheck] = useState(true)

  const fileInputFrontRef = useRef<HTMLInputElement>(null)
  const fileInputBackRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    if (e.target.files && e.target.files.length > 0) {
      if (side === 'front') setValidIdFront(e.target.files[0])
      else setValidIdBack(e.target.files[0])
    }
  }

  // Form values
  const [beneficiaryId, setBeneficiaryId] = useState('')
  const [assistanceType, setAssistanceType] = useState('')
  const [purpose, setPurpose] = useState('')
  const [amountRange, setAmountRange] = useState('')
  const [remarks, setRemarks] = useState('')
  const [extraFields, setExtraFields] = useState<Record<string, string>>({})

  // Personal info (auto-filled from beneficiary, editable)
  const [personalInfo, setPersonalInfo] = useState({
    full_name: '', address: '', contact_number: '', email: '',
    birthdate: '', civil_status: '', occupation: '', monthly_income: '',
    household_size: '', barangay: '',
    sex: '', is_pwd: false, is_senior: false, is_4ps: false
  })

  const updatePersonal = (key: string, value: string) =>
    setPersonalInfo(prev => ({ ...prev, [key]: value }))

  // ── Role Guard & Load Beneficiary ────────────────────────────
  useEffect(() => {
    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role && profile.role !== 'resident') {
        router.replace('/requests')
        return
      }

      const { data: b } = await supabase.from('beneficiaries').select('*').eq('created_by', user.id).maybeSingle()
      if (!b) {
        setIsUnregistered(true)
        setLoadingCheck(false)
        return
      }

      setMyBeneficiary(b)
      setBeneficiaryId(b.id)
      setPersonalInfo({
        full_name: `${b.last_name}, ${b.first_name}${b.middle_name ? ' ' + b.middle_name : ''}${b.suffix ? ' ' + b.suffix : ''}`,
        address: b.address || '',
        contact_number: b.contact_number || '',
        email: '',
        birthdate: b.birthdate || '',
        civil_status: b.civil_status || '',
        occupation: b.occupation || '',
        monthly_income: b.monthly_income?.toString() || '',
        household_size: b.family_size?.toString() || '',
        barangay: b.barangay || '',
        sex: b.sex || '',
        is_pwd: b.is_pwd || false,
        is_senior: b.is_senior || false,
        is_4ps: b.is_4ps || false
      })

      // DUPLICATE PREVENTION CHECK
      // 1. Get restriction days
      const { data: settings } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'duplicate_restriction_days').single()
      const rDays = settings ? parseInt(settings.setting_value) : 30
      setRestrictionDays(rDays)

      // 2. Fetch all requests for this beneficiary
      const { data: requests } = await supabase.from('requests').select('*').eq('beneficiary_id', b.id)
      if (requests) {
        // Check for active requests
        const activeReq = requests.find((r: any) => r.status === 'Pending' || r.status === 'Approved')
        if (activeReq) {
          setIsBlocked(true)
          setBlockedMessage('You already have an existing AICS request that is currently being processed. Multiple active requests are not allowed. Please wait for the status of your current application.')
          
          await supabase.from('system_logs').insert({
            user_id: user.id,
            action: 'BLOCKED_DUPLICATE_REQUEST',
            details: { reason: 'Active request exists', beneficiary_id: b.id }
          })
        } else {
          // Check for recent requests
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - rDays)
          const recent = requests.filter((r: any) => new Date(r.created_at) >= cutoff)
          setRecentRequests(recent)
        }
      }

      setLoadingCheck(false)
    }
    initPage()
  }, [router, supabase])

  // ── Load requirements when type changes ──────────────────────
  useEffect(() => {
    if (assistanceType) {
      supabase.from('assistance_requirements')
        .select('*')
        .eq('assistance_type', assistanceType)
        .then(({ data }: { data: any }) => {
          setRequirements(data ?? [])
          setPreparedDocs({})
        })
      setExtraFields({})
      setAmountRange('')
    }
  }, [assistanceType, supabase])

  const togglePreparedDoc = (id: string) => {
    setPreparedDocs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Navigation logic ─────────────────────────────────────────
  const nextStep = () => {
    if (step === 1) {
      if (!assistanceType) { setError(t('newRequest_selectType')); return }
      setStep(2)
      setError('')
    } else if (step === 2) {
      if (!purpose || purpose.length < 5) { setError(t('newRequest_reasonRequired')); return }
      if (!amountRange) { setError(t('newRequest_selectAmountRange')); return }
      
      const fields = TYPE_FIELDS[assistanceType] || []
      for (const f of fields) {
        if (f.required && !extraFields[f.key]) {
          setError(`${f.label} ${t('required').toLowerCase()}`)
          return
        }
      }
      setStep(3)
      setError('')
    }
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  // ── Submit ───────────────────────────────────────────────────
  const onSubmit = async () => {
    if (!beneficiaryId || isUnregistered) {
      setError('You must complete your beneficiary registration before submitting an AICS request.')
      return
    }

    if (!validIdFront || !validIdBack) {
      setError(t('newRequest_frontRequired'))
      return
    }

    const missingDocs = requirements.filter(r => r.is_required && !preparedDocs[r.id])
    if (missingDocs.length > 0) {
      setError(t('newRequest_allDocumentsRequired'))
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: req, error: reqErr } = await supabase.from('requests').insert({
        beneficiary_id: beneficiaryId,
        assistance_type: assistanceType,
        purpose,
        remarks: remarks || null,
        extra_fields: { ...extraFields, amount_range: amountRange, personal_info: personalInfo },
        encoded_by: user.id,
        status: 'Pending',
      }).select().single()

      if (reqErr) throw reqErr

      // Upload ID photos
      const uploadFile = async (file: File, side: string) => {
        const path = `requests/${req.id}/valid_id_${side}_${Date.now()}`
        const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file)
        if (uploadErr) throw uploadErr
        
        await supabase.from('request_documents').insert({
          request_id: req.id,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          uploaded_by: user.id,
          document_type: `Valid ID (${side.charAt(0).toUpperCase() + side.slice(1)})`
        })
      }

      await uploadFile(validIdFront, 'front')
      await uploadFile(validIdBack, 'back')

      // Log activity
      await supabase.from('system_logs').insert({
        user_id: user.id,
        action: 'CREATE_REQUEST',
        table_name: 'requests',
        record_id: req.id,
        details: { type: assistanceType, beneficiary_id: beneficiaryId }
      })

      router.push('/requests')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  const InfoField = ({ label, value }: { label: string, value: string }) => (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
      <p className="font-bold text-[var(--color-text)]">{value || '—'}</p>
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-[var(--color-card)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <FileText size={18} className="text-blue-500" />
          </div>
          {t('newRequest_stepBeneficiary')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ASSISTANCE_TYPES.map(type => {
            const Icon = TYPE_ICONS[type]
            const active = assistanceType === type
            const isRestricted = recentRequests.some(r => r.assistance_type === type)
            
            return (
              <button
                key={type}
                onClick={() => {
                  if (isRestricted) {
                    setError(`You have already submitted a request for ${type} assistance within the last ${restrictionDays} days. Please wait for the restriction period to end.`)
                    supabase.from('system_logs').insert({
                       action: 'BLOCKED_DUPLICATE_REQUEST',
                       details: { reason: 'Restriction period', type, beneficiary_id: myBeneficiary?.id }
                    })
                  } else {
                    setAssistanceType(type)
                  }
                }}
                className={`flex flex-col items-center p-6 rounded-2xl border-2 transition-all duration-300 group ${
                  active 
                  ? 'border-blue-500 bg-blue-500/5 ring-4 ring-blue-500/10' 
                  : isRestricted
                  ? 'border-red-200 bg-red-50/50 opacity-60 cursor-not-allowed'
                  : 'border-[var(--color-border)] hover:border-blue-500/50 hover:bg-slate-50'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                  active ? 'bg-blue-500 text-white' : isRestricted ? 'bg-red-100 text-red-400' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'
                }`}>
                  <Icon size={28} />
                </div>
                <span className={`font-bold text-sm ${active ? 'text-blue-600' : isRestricted ? 'text-red-500' : 'text-[var(--color-text-secondary)]'}`}>
                  {t(type.toLowerCase() as any)}
                </span>
                {isRestricted && (
                  <span className="text-[10px] font-bold text-red-500 mt-2 bg-red-100 px-2 py-0.5 rounded uppercase tracking-widest">
                    Restricted
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <User size={18} className="text-emerald-500" />
          </div>
          {t('newRequest_personalInfo')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <InfoField label={t('settings_fullName').replace(' *','')} value={personalInfo.full_name} />
          <InfoField label={t('beneficiary_barangay').replace(' *','')} value={personalInfo.barangay} />
          <InfoField label={t('settings_completeAddress').replace(' *','')} value={personalInfo.address} />
          <InfoField label={t('settings_contactNumber').replace(' *','')} value={personalInfo.contact_number} />
          <InfoField label={t('settings_dateOfBirth').replace(' *','')} value={personalInfo.birthdate} />
          <InfoField label={t('settings_sex').replace(' *','')} value={personalInfo.sex ? t(personalInfo.sex.toLowerCase() as any) : ''} />
          <InfoField label={t('settings_civilStatus').replace(' *','')} value={personalInfo.civil_status ? t(`settings_${personalInfo.civil_status.toLowerCase()}` as any) : ''} />
          <InfoField label={t('settings_occupation').replace(' *','')} value={personalInfo.occupation} />
          <InfoField label={t('settings_monthlyIncome').replace(' *','')} value={personalInfo.monthly_income ? `₱${personalInfo.monthly_income}` : ''} />
          <InfoField label={t('settings_familySize').replace(' *','')} value={personalInfo.household_size} />
          <InfoField label={t('settings_isPwd')} value={personalInfo.is_pwd ? t('yes') : t('no')} />
          <InfoField label={t('settings_isSenior')} value={personalInfo.is_senior ? t('yes') : t('no')} />
          <InfoField label={t('settings_is4ps')} value={personalInfo.is_4ps ? t('yes') : t('no')} />
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-[var(--color-card)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-8 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <FileText size={18} className="text-blue-500" />
          </div>
          {t('newRequest_stepDetails')}
        </h2>

        <div className="space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('newRequest_purpose')}</label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="form-input min-h-[120px] bg-slate-50/50 focus:bg-white transition-all text-lg"
              placeholder={t('newRequest_purposePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('newRequest_amountRange')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(AMOUNT_RANGES[assistanceType] || []).map(range => (
                <button
                  key={range}
                  onClick={() => setAmountRange(range)}
                  className={`p-4 rounded-xl border-2 text-sm font-bold transition-all ${
                    amountRange === range 
                    ? 'border-blue-500 bg-blue-500/5 text-blue-600 ring-4 ring-blue-500/10' 
                    : 'border-[var(--color-border)] hover:border-blue-300'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-[var(--color-border)]">
            {TYPE_FIELDS[assistanceType]?.map(field => (
              <div key={field.key} className="space-y-2">
                <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{field.label}</label>
                <input
                  type={field.type}
                  value={extraFields[field.key] || ''}
                  onChange={(e) => setExtraFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="form-input bg-slate-50/50 focus:bg-white transition-all"
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-4">
            <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('newRequest_remarks')}</label>
            <input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="form-input bg-slate-50/50 focus:bg-white transition-all"
              placeholder={t('newRequest_remarksPlaceholder')}
            />
          </div>
        </div>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-[var(--color-card)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <CreditCard size={18} className="text-blue-500" />
          </div>
          {t('newRequest_idCapture')}
        </h2>
        <p className="text-[var(--color-text-secondary)] text-sm mb-8">{t('newRequest_idCaptureDesc')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('newRequest_frontSide')}</label>
              {validIdFront && (
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest">{t('success')}</span>
              )}
            </div>
            
            <div className={`relative aspect-[4/3] rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
              validIdFront ? 'border-emerald-500/30' : 'border-[var(--color-border)] border-dashed bg-slate-50/50'
            }`}>
              {validIdFront ? (
                <>
                  <img src={URL.createObjectURL(validIdFront)} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button onClick={() => setCameraOpen('front')} className="p-3 bg-white rounded-full text-blue-600 hover:scale-110 transition-transform shadow-xl">
                      <Camera size={20} />
                    </button>
                    <button onClick={() => fileInputFrontRef.current?.click()} className="p-3 bg-white rounded-full text-blue-600 hover:scale-110 transition-transform shadow-xl">
                      <Upload size={20} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                    <Camera size={32} className="text-blue-400" />
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-[200px]">
                    <button onClick={() => setCameraOpen('front')} className="btn btn-primary w-full py-2.5 shadow-lg shadow-blue-500/20">
                      {t('newRequest_openCamera')}
                    </button>
                    <button onClick={() => fileInputFrontRef.current?.click()} className="btn btn-secondary w-full py-2.5">
                      {t('newRequest_uploadImage')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputFrontRef} onChange={(e) => handleFileUpload(e, 'front')} className="hidden" accept="image/*" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('newRequest_backSide')}</label>
              {validIdBack && (
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest">{t('success')}</span>
              )}
            </div>
            
            <div className={`relative aspect-[4/3] rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
              validIdBack ? 'border-emerald-500/30' : 'border-[var(--color-border)] border-dashed bg-slate-50/50'
            }`}>
              {validIdBack ? (
                <>
                  <img src={URL.createObjectURL(validIdBack)} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button onClick={() => setCameraOpen('back')} className="p-3 bg-white rounded-full text-blue-600 hover:scale-110 transition-transform shadow-xl">
                      <Camera size={20} />
                    </button>
                    <button onClick={() => fileInputBackRef.current?.click()} className="p-3 bg-white rounded-full text-blue-600 hover:scale-110 transition-transform shadow-xl">
                      <Upload size={20} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                    <Camera size={32} className="text-blue-400" />
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-[200px]">
                    <button onClick={() => setCameraOpen('back')} className="btn btn-primary w-full py-2.5 shadow-lg shadow-blue-500/20">
                      {t('newRequest_openCamera')}
                    </button>
                    <button onClick={() => fileInputBackRef.current?.click()} className="btn btn-secondary w-full py-2.5">
                      {t('newRequest_uploadImage')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputBackRef} onChange={(e) => handleFileUpload(e, 'back')} className="hidden" accept="image/*" />
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Check size={18} className="text-emerald-500" />
          </div>
          {t('newRequest_stepDocuments')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requirements.map((req) => (
            <div key={req.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 ${
              preparedDocs[req.id] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-[var(--color-border)]'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  preparedDocs[req.id] ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${preparedDocs[req.id] ? 'text-emerald-700' : 'text-[var(--color-text)]'}`}>
                    {req.document_name}
                  </h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                    {req.is_required ? t('required') : t('optional')}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => togglePreparedDoc(req.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  preparedDocs[req.id] 
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                  : 'bg-white text-slate-400 border border-slate-200 hover:border-emerald-300 hover:text-emerald-500'
                }`}
              >
                {preparedDocs[req.id] ? (
                  <><Check size={14} /> {t('newRequest_prepared')}</>
                ) : (
                  t('newRequest_markPrepared')
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  if (loadingCheck) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-slate-400 text-sm font-medium">Checking beneficiary registration status...</p>
      </div>
    )
  }

  if (isUnregistered) {
    return (
      <div className="max-w-lg mx-auto my-14 card p-8 sm:p-10 text-center space-y-6 bg-slate-900/90 border border-slate-800 shadow-2xl rounded-2xl animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert size={36} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">In-Person Registration Required</h2>
          <p className="text-slate-300 text-sm leading-relaxed max-w-md mx-auto">
            You must first be registered as a beneficiary at the <strong className="text-white">Daanbantayan MSWD Office</strong> before you can submit an AICS request. Please visit us in person with valid identification.
          </p>
        </div>
        <div className="bg-slate-800/60 rounded-xl p-4 text-left space-y-3 border border-slate-700/50">
          <div className="flex items-start gap-3 text-sm text-slate-300">
            <MapPin size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <span>Daanbantayan MSWD Office, Daanbantayan, Cebu</span>
          </div>
          <div className="flex items-start gap-3 text-sm text-slate-300">
            <Phone size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <span>Contact the MSWD office for office hours and requirements</span>
          </div>
        </div>
        <Link href="/resident/dashboard" className="px-6 py-3 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 text-sm font-semibold transition-colors text-center border border-slate-700/50 inline-block">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" id="new-request-page">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('newRequest_title')}</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">{t('newRequest_subtitle')}</p>
      </div>

      <div className="flex items-center gap-2">
        {[
          { n: 1, label: t('newRequest_step1Label') },
          { n: 2, label: t('newRequest_step2Label') },
          { n: 3, label: t('newRequest_step3Label') },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${step === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' :
                step > n ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              {step > n ? <Check size={14} /> : n}
            </div>
            <span className={`text-xs font-semibold hidden sm:block ${step === n ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
            {n < 3 && <div className={`flex-1 h-0.5 rounded ${step > n ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {isBlocked ? (
        <div className="bg-red-50/80 border border-red-200 rounded-2xl p-8 text-center animate-in fade-in slide-in-from-bottom-4">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-red-700 mb-2">Request Blocked</h2>
          <p className="text-red-600/80 max-w-md mx-auto mb-6">{blockedMessage}</p>
          <button onClick={() => router.push('/requests')} className="btn btn-secondary bg-white">
            Return to My Requests
          </button>
        </div>
      ) : (
        <>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={18} />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="flex justify-between items-center pt-4">
        {!isBlocked && step > 1 ? (
          <button onClick={prevStep} className="btn btn-secondary flex items-center gap-2 px-6">
            <ChevronLeft size={18} /> {t('back')}
          </button>
        ) : <div />}

        {!isBlocked && (
          <button
            onClick={step === 3 ? onSubmit : nextStep}
            disabled={saving}
            className="btn btn-primary flex items-center gap-2 min-w-[140px] justify-center py-3 shadow-xl shadow-blue-500/20"
          >
            {saving ? (
              <><Loader2 size={18} className="animate-spin" /> {t('submitting')}</>
            ) : (
              <>
                {step === 3 ? t('newRequest_submit') : t('next')}
                <ChevronRight size={18} />
              </>
            )}
          </button>
        )}
      </div>

      <CameraModal
        isOpen={cameraOpen === 'front'}
        label={`${t('newRequest_idCapture')} — ${t('newRequest_frontSide')}`}
        onCapture={file => { setValidIdFront(file); setCameraOpen(null) }}
        onClose={() => setCameraOpen(null)}
      />
      <CameraModal
        isOpen={cameraOpen === 'back'}
        label={`${t('newRequest_idCapture')} — ${t('newRequest_backSide')}`}
        onCapture={file => { setValidIdBack(file); setCameraOpen(null) }}
        onClose={() => setCameraOpen(null)}
      />
    </div>
  )
}
