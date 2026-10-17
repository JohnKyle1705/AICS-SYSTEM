'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  ASSISTANCE_TYPES, 
  BARANGAYS, 
  FUNERAL_HOMES_BOGO_TO_DAANBANTAYAN, 
  BENEFICIARY_RELATIONSHIPS 
} from '@/lib/constants'
import {
  Loader2, Check, X, FileText, AlertCircle, ChevronRight,
  ChevronLeft, GraduationCap, Stethoscope, UtensilsCrossed, Cross,
  Camera, RotateCcw, User, CreditCard, Upload, ShieldAlert, Search
} from 'lucide-react'
import Link from 'next/link'
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

// Burial name fields — outside component to prevent recreation on each render
const BURIAL_NAME_FIELDS = [
  { key: 'deceased_first_name',  label: 'First Name of Deceased',  placeholder: 'e.g. Juan',          required: true  },
  { key: 'deceased_middle_name', label: 'Middle Name of Deceased', placeholder: 'e.g. Santos',        required: false },
  { key: 'deceased_last_name',   label: 'Last Name of Deceased',   placeholder: 'e.g. Dela Cruz',     required: true  },
  { key: 'deceased_suffix',      label: 'Suffix',                  placeholder: 'e.g. Jr., Sr., III', required: false },
] as const

const MEDICAL_FIELDS = [
  { key: 'hospital_name',  label: 'Hospital / Clinic Name', type: 'text',   placeholder: 'e.g. Vicente Sotto Memorial Medical Center', required: true  },
  { key: 'diagnosis',      label: 'Diagnosis',              type: 'text',   placeholder: 'e.g. Dengue Hemorrhagic Fever',              required: true  },
  { key: 'estimated_cost', label: 'Estimated Cost (₱)',     type: 'number', placeholder: '0.00',                                       required: true  },
] as const

// ── Searchable combobox for funeral home ──────────────────────────────────
function FuneralHomeCombobox({
  value, onChange, hasError
}: { value: string; onChange: (v: string) => void; hasError?: boolean }) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const containerRef      = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() =>
    query.trim() === ''
      ? FUNERAL_HOMES_BOGO_TO_DAANBANTAYAN
      : FUNERAL_HOMES_BOGO_TO_DAANBANTAYAN.filter(h =>
          h.toLowerCase().includes(query.toLowerCase())
        ),
    [query]
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (opt: string) => { onChange(opt); setQuery(''); setOpen(false) }
  const clear  = () => { onChange(''); setQuery('') }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`form-input flex items-center gap-2 cursor-pointer bg-slate-50/50 hover:bg-white transition-all select-none${hasError ? ' border-red-400 ring-2 ring-red-100 bg-red-50/30' : ''}`}
        onClick={() => { setOpen(v => !v); setTimeout(() => (containerRef.current?.querySelector('input') as HTMLInputElement)?.focus(), 50) }}
      >
        <Search size={14} className="text-slate-400 shrink-0" />
        {value
          ? <span className="truncate text-sm font-medium text-[var(--color-text)] flex-1">{value}</span>
          : <span className="text-sm text-slate-400 flex-1">Search or select a funeral home…</span>
        }
        {value && (
          <button type="button" onClick={e => { e.stopPropagation(); clear() }} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to filter…"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-4 py-3 text-sm text-slate-400 text-center">No funeral homes match your search.</li>
              : filtered.map(opt => (
                <li
                  key={opt} onClick={() => select(opt)}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 ${
                    value === opt ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-[var(--color-text)] hover:bg-slate-50'
                  }`}
                >
                  {value === opt ? <Check size={13} className="shrink-0 text-blue-600" /> : <span className="w-[13px] shrink-0" />}
                  {opt}
                </li>
              ))
            }
          </ul>
          {filtered.length > 0 && (
            <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
              {filtered.length} of {FUNERAL_HOMES_BOGO_TO_DAANBANTAYAN.length} funeral homes · Bogo to Daanbantayan area only
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function NewRequestPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLanguage()


  // ── State ────────────────────────────────────────────────────

  const [step, setStep] = useState(1)
  const [myBeneficiary, setMyBeneficiary] = useState<any>(null)
  const [requirements, setRequirements] = useState<any[]>([])
  const [preparedDocs, setPreparedDocs] = useState<Record<string, boolean>>({})
  const [validIdFront, setValidIdFront] = useState<File | null>(null)
  const [validIdBack, setValidIdBack] = useState<File | null>(null)
  const [cameraOpen, setCameraOpen] = useState<'front' | 'back' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error,       setError]       = useState('')
  /** Per-field inline validation errors */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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
  const [isDraggingFront, setIsDraggingFront] = useState(false)
  const [isDraggingBack, setIsDraggingBack] = useState(false)

  const validateAndSetPhoto = (file: File, side: 'front' | 'back'): boolean => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const validExts = ['jpg', 'jpeg', 'png', 'webp']
    const isMimeValid = file.type ? validTypes.includes(file.type.toLowerCase()) : false
    const isExtValid = validExts.includes(ext)

    if (!isMimeValid && !isExtValid) {
      setError('Invalid file type. Please upload a JPG, JPEG, PNG, or WEBP image.')
      return false
    }

    // Validate file size (max 10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. The maximum allowed size is 10 MB.')
      return false
    }

    setError('')
    if (side === 'front') setValidIdFront(file)
    else setValidIdBack(file)
    return true
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetPhoto(e.target.files[0], side)
      e.target.value = ''
    }
  }

  // Form values
  const [beneficiaryId, setBeneficiaryId] = useState('')
  const [assistanceType, setAssistanceType] = useState('')
  const [purpose, setPurpose] = useState('')
  const [amountRange, setAmountRange] = useState('')
  const [remarks, setRemarks] = useState('')
  const [extraFields, setExtraFields] = useState<Record<string, string>>({})

  /** Set an extra field and clear its inline error immediately */
  const setField = (key: string, value: string) => {
    setExtraFields(prev => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }
  const clearFieldError = (key: string) =>
    setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n })

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
      setFieldErrors({})
    }
  }, [assistanceType, supabase])

  const togglePreparedDoc = (id: string) => {
    setPreparedDocs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Per-field validation — collects ALL errors at once ────────
  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {}
    if (!purpose || purpose.trim().length < 5)
      errs['purpose'] = 'Please describe the reason for your request (at least 5 characters).'
    if (!amountRange)
      errs['amount_range'] = 'Please select an amount range.'
    if (assistanceType === 'Burial') {
      for (const f of BURIAL_NAME_FIELDS) {
        if (f.required && !extraFields[f.key]?.trim()) errs[f.key] = `${f.label} is required.`
      }
      if (!extraFields['relationship']?.trim()) errs['relationship'] = 'Relationship to Beneficiary is required.'
      if (!extraFields['funeral_home']?.trim()) errs['funeral_home'] = 'Please select a funeral home.'
    } else if (assistanceType === 'Medical') {
      for (const f of MEDICAL_FIELDS) {
        if (f.required && !extraFields[f.key]?.trim()) errs[f.key] = `${f.label} is required.`
      }
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Navigation logic ──────────────────────────────────────────
  const nextStep = () => {
    if (step === 1) {
      if (!assistanceType) { setError(t('newRequest_selectType')); return }
      setStep(2); setError('')
    } else if (step === 2) {
      if (!validateStep2()) { setError('Please fix the highlighted fields before continuing.'); return }
      setStep(3); setError('')
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

    if (!validIdFront && !validIdBack) {
      setError('Both Front Side and Back Side photos of your Valid ID are required.')
      return
    }
    if (!validIdFront) {
      setError('Front Side photo of your Valid ID is required.')
      return
    }
    if (!validIdBack) {
      setError('Back Side photo of your Valid ID is required.')
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

      const deceasedFullName = assistanceType === 'Burial'
        ? [extraFields.deceased_first_name, extraFields.deceased_middle_name, extraFields.deceased_last_name, extraFields.deceased_suffix]
            .filter(Boolean)
            .join(' ')
            .trim()
        : ''

      const { data: req, error: reqErr } = await supabase.from('requests').insert({
        beneficiary_id: beneficiaryId,
        assistance_type: assistanceType,
        purpose,
        remarks: remarks || null,
        extra_fields: { 
          ...extraFields, 
          ...(deceasedFullName ? { deceased_name: deceasedFullName } : {}),
          amount_range: amountRange, 
          personal_info: personalInfo 
        },
        encoded_by: user.id,
        status: 'Pending',
      }).select().single()

      if (reqErr) throw reqErr

      // Upload ID photos
      const uploadFile = async (file: File, side: string) => {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `requests/${req.id}/valid_id_${side}_${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file, {
          contentType: file.type || 'image/jpeg'
        })
        if (uploadErr) throw uploadErr
        
        await supabase.from('request_documents').insert({
          request_id: req.id,
          file_name: `Valid ID (${side === 'front' ? 'Front' : 'Back'}) - ${file.name}`,
          file_path: path,
          file_type: file.type || 'image/jpeg',
          uploaded_by: user.id
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

  /** Inline field error message */
  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? (
      <p className="flex items-center gap-1 text-xs font-semibold text-red-500 mt-1">
        <AlertCircle size={11} />{fieldErrors[name]}
      </p>
    ) : null

  /** Returns class string with red border when field has an error */
  const fc = (name: string, base = 'form-input bg-slate-50/50 dark:bg-slate-800/50 focus:bg-[var(--color-surface)] transition-all') =>
    `${base}${fieldErrors[name] ? ' border-red-400 ring-2 ring-red-100 dark:ring-red-900/40 bg-red-50/30 dark:bg-red-900/20' : ''}`

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
          <div className="space-y-1">
            <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('newRequest_purpose')}</label>
            <textarea
              value={purpose}
              onChange={(e) => { setPurpose(e.target.value); clearFieldError('purpose') }}
              className={fc('purpose', 'form-input min-h-[120px] bg-slate-50/50 dark:bg-slate-800/50 focus:bg-[var(--color-surface)] transition-all text-lg')}
              placeholder={t('newRequest_purposePlaceholder')}
            />
            <FieldError name="purpose" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('newRequest_amountRange')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(AMOUNT_RANGES[assistanceType] || []).map(range => (
                <button
                  key={range}
                  onClick={() => { setAmountRange(range); clearFieldError('amount_range') }}
                  className={`p-4 rounded-xl border-2 text-sm font-bold transition-all ${
                    amountRange === range
                    ? 'border-blue-500 bg-blue-500/5 text-blue-600 ring-4 ring-blue-500/10'
                    : fieldErrors['amount_range']
                    ? 'border-red-300 hover:border-blue-300'
                    : 'border-[var(--color-border)] hover:border-blue-300'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <FieldError name="amount_range" />
          </div>

          {/* ── BURIAL section ───────────────────────────────────────── */}
          {assistanceType === 'Burial' && (
            <div className="pt-8 border-t border-[var(--color-border)] space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                  <Cross size={15} className="text-slate-500" />
                  Deceased Person's Information
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Fill in the complete name of the deceased.
                  Fields marked <span className="text-red-500 font-bold">*</span> are required.
                </p>
              </div>

              {/* Name fields — 2×2 grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {BURIAL_NAME_FIELDS.map(f => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
                      {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <input
                      type="text"
                      value={extraFields[f.key] || ''}
                      onChange={e => setField(f.key, e.target.value)}
                      className={fc(f.key)}
                      placeholder={f.placeholder}
                    />
                    <FieldError name={f.key} />
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                  <FileText size={15} className="text-slate-500" />
                  Funeral Arrangements
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Only verified funeral homes within the Bogo to Daanbantayan area are listed.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Relationship */}
                <div className="space-y-1">
                  <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
                    Relationship to Beneficiary<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <select
                    value={extraFields['relationship'] || ''}
                    onChange={e => setField('relationship', e.target.value)}
                    className={fc('relationship')}
                  >
                    <option value="">— Select Relationship —</option>
                    {BENEFICIARY_RELATIONSHIPS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <FieldError name="relationship" />
                </div>

                {/* Funeral home — searchable combobox */}
                <div className="space-y-1">
                  <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
                    Funeral Home (Bogo – Daanbantayan)<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <FuneralHomeCombobox
                    value={extraFields['funeral_home'] || ''}
                    onChange={v => setField('funeral_home', v)}
                    hasError={!!fieldErrors['funeral_home']}
                  />
                  <FieldError name="funeral_home" />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {FUNERAL_HOMES_BOGO_TO_DAANBANTAYAN.length} verified homes. Not listed? Select "Other Funeral Home (Within Bogo to Daanbantayan Area)".
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── MEDICAL section ─────────────────────────────────────── */}
          {assistanceType === 'Medical' && (
            <div className="pt-8 border-t border-[var(--color-border)] space-y-4">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text)]">Medical Assistance Details</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Hospital and medical diagnostic details.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {MEDICAL_FIELDS.map(f => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
                      {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <input
                      type={f.type}
                      value={extraFields[f.key] || ''}
                      onChange={e => setField(f.key, e.target.value)}
                      className={fc(f.key)}
                      placeholder={f.placeholder}
                    />
                    <FieldError name={f.key} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-6 border-t border-[var(--color-border)]">
            <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('newRequest_remarks')}</label>
            <input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="form-input bg-slate-50/50 dark:bg-slate-800/50 focus:bg-[var(--color-surface)] transition-all"
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
          {/* ── Front Side ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('newRequest_frontSide')}</label>
              {validIdFront && (
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                  <Check size={10} /> {t('success')}
                </span>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDraggingFront(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setIsDraggingFront(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setIsDraggingFront(false)
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  validateAndSetPhoto(e.dataTransfer.files[0], 'front')
                }
              }}
              className={`relative aspect-[4/3] rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
                isDraggingFront
                  ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                  : validIdFront
                  ? 'border-emerald-500/30'
                  : 'border-[var(--color-border)] border-dashed bg-slate-50/50 dark:bg-slate-800/30'
              }`}
            >
              {validIdFront ? (
                <img src={URL.createObjectURL(validIdFront)} className="w-full h-full object-cover" alt="Valid ID Front" />
              ) : isDraggingFront ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-blue-500/10">
                  <Upload size={36} className="text-blue-500 animate-bounce mb-2" />
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">Drop Front ID photo here</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                    <Camera size={32} className="text-blue-400" />
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-[200px]">
                    <button
                      type="button"
                      onClick={() => setCameraOpen('front')}
                      className="btn btn-primary w-full py-2.5 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      <Camera size={16} /> {t('newRequest_openCamera')}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputFrontRef.current?.click()}
                      className="btn btn-secondary w-full py-2.5 flex items-center justify-center gap-2"
                    >
                      <Upload size={16} /> {t('newRequest_uploadImage')}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">or drag and drop photo here</p>
                </div>
              )}
            </div>

            {/* Always-visible action buttons when photo exists */}
            {validIdFront && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    fileInputFrontRef.current?.click()
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-400 transition-colors border border-blue-200 dark:border-blue-800"
                >
                  <RotateCcw size={13} /> Replace Photo
                </button>
                <button
                  type="button"
                  onClick={() => setCameraOpen('front')}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-400 transition-colors border border-blue-200 dark:border-blue-800"
                >
                  <Camera size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setValidIdFront(null)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors border border-red-200 dark:border-red-800"
                >
                  <X size={13} /> Remove
                </button>
              </div>
            )}

            <input
              type="file"
              ref={fileInputFrontRef}
              onChange={(e) => handleFileUpload(e, 'front')}
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            />
          </div>

          {/* ── Back Side ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('newRequest_backSide')}</label>
              {validIdBack && (
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                  <Check size={10} /> {t('success')}
                </span>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDraggingBack(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setIsDraggingBack(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setIsDraggingBack(false)
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  validateAndSetPhoto(e.dataTransfer.files[0], 'back')
                }
              }}
              className={`relative aspect-[4/3] rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
                isDraggingBack
                  ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                  : validIdBack
                  ? 'border-emerald-500/30'
                  : 'border-[var(--color-border)] border-dashed bg-slate-50/50 dark:bg-slate-800/30'
              }`}
            >
              {validIdBack ? (
                <img src={URL.createObjectURL(validIdBack)} className="w-full h-full object-cover" alt="Valid ID Back" />
              ) : isDraggingBack ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-blue-500/10">
                  <Upload size={36} className="text-blue-500 animate-bounce mb-2" />
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">Drop Back ID photo here</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                    <Camera size={32} className="text-blue-400" />
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-[200px]">
                    <button
                      type="button"
                      onClick={() => setCameraOpen('back')}
                      className="btn btn-primary w-full py-2.5 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      <Camera size={16} /> {t('newRequest_openCamera')}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputBackRef.current?.click()}
                      className="btn btn-secondary w-full py-2.5 flex items-center justify-center gap-2"
                    >
                      <Upload size={16} /> {t('newRequest_uploadImage')}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">or drag and drop photo here</p>
                </div>
              )}
            </div>

            {/* Always-visible action buttons when photo exists */}
            {validIdBack && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputBackRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-400 transition-colors border border-blue-200 dark:border-blue-800"
                >
                  <RotateCcw size={13} /> Replace Photo
                </button>
                <button
                  type="button"
                  onClick={() => setCameraOpen('back')}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-400 transition-colors border border-blue-200 dark:border-blue-800"
                >
                  <Camera size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setValidIdBack(null)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors border border-red-200 dark:border-red-800"
                >
                  <X size={13} /> Remove
                </button>
              </div>
            )}

            <input
              type="file"
              ref={fileInputBackRef}
              onChange={(e) => handleFileUpload(e, 'back')}
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            />
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
          <h2 className="text-2xl font-bold text-white">Beneficiary Registration Required</h2>
          <p className="text-slate-300 text-sm leading-relaxed max-w-md mx-auto">
            You must complete your beneficiary registration before submitting an AICS request.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/beneficiaries/new" className="btn btn-primary px-7 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 text-center">
            Complete Registration
          </Link>
          <Link href="/resident/dashboard" className="px-6 py-3 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 text-sm font-semibold transition-colors text-center border border-slate-700/50">
            Back to Dashboard
          </Link>
        </div>
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
