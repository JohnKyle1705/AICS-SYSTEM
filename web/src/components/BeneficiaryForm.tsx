'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { BARANGAY_PAJO, PUROKS_PAJO } from '@/lib/constants'
import { Loader2 } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'


const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Required'),
  suffix: z.string().optional(),
  birthdate: z.string().min(1, 'Required'),
  sex: z.enum(['Male', 'Female']),
  civil_status: z.enum(['Single', 'Married', 'Widowed', 'Separated', 'Annulled']),
  barangay: z.string().min(1, 'Required'),
  purok: z.string().min(1, 'Required'),
  address: z.string().min(1, 'Required'),
  contact_number: z.string().optional().refine(val => !val || (val.length === 11 && val.startsWith('09') && /^\d+$/.test(val)), 'Enter a valid 11-digit contact number (e.g., 09XXXXXXXXX)'),
  is_pwd: z.boolean(),
  is_senior: z.boolean(),
  is_4ps: z.boolean(),
  monthly_income: z.coerce.number().min(0, 'Must be positive'),
  occupation: z.string().min(1, 'Required'),
  family_size: z.coerce.number().min(1, 'Must be at least 1'),
})

type FormData = z.infer<typeof schema>

interface Props { beneficiaryId?: string }

export default function BeneficiaryForm({ beneficiaryId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLanguage()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')


  const [effectiveBeneficiaryId, setEffectiveBeneficiaryId] = useState<string | undefined>(beneficiaryId)
  const [isResident, setIsResident] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { is_pwd: false, is_senior: false, is_4ps: false, monthly_income: 0, family_size: 1, barangay: BARANGAY_PAJO },
  })

  useEffect(() => {
    const loadBeneficiary = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const userIsResident = profile?.role === 'resident'
      setIsResident(userIsResident)

      if (beneficiaryId) {
        setEffectiveBeneficiaryId(beneficiaryId)
        const { data } = await supabase.from('beneficiaries').select('*').eq('id', beneficiaryId).single()
        if (data) reset(data)
      } else if (userIsResident) {
        // If resident is visiting registration form, check if they already registered
        const { data: existing } = await supabase.from('beneficiaries').select('*').eq('created_by', user.id).maybeSingle()
        if (existing) {
          setEffectiveBeneficiaryId(existing.id)
          reset(existing)
        }
      }
    }
    loadBeneficiary()
  }, [beneficiaryId, reset, supabase])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in to register.')
      setSaving(false)
      return
    }

    const payload = { ...data, created_by: user.id }
    const targetId = effectiveBeneficiaryId || beneficiaryId

    const { error: err, data: savedBeneficiary } = targetId
      ? await supabase.from('beneficiaries').update(payload).eq('id', targetId).select('id').single()
      : await supabase.from('beneficiaries').insert(payload).select('id').single()

    if (err) { setError(err.message); setSaving(false); return }

    // Log action
    await supabase.from('system_logs').insert({
      user_id: user.id,
      action: targetId ? 'UPDATE_BENEFICIARY' : 'CREATE_BENEFICIARY',
      table_name: 'beneficiaries',
      record_id: targetId || savedBeneficiary?.id,
    })

    if (isResident) {
      router.push('/resident/dashboard?registered=true')
    } else {
      router.push('/beneficiaries')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" id="beneficiary-form">
      <div className="card p-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-5 text-[15px]">{t('newRequest_personalInfoTitle')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="form-label">{t('newRequest_fullName')} ({t('newRequest_step1Label')}) *</label>
            <input {...register('first_name')} className="form-input" placeholder="Juan" />
            {errors.first_name && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>

          <div>
            <label className="form-label">{t('middle_name') || 'Middle Name'}</label>
            <input {...register('middle_name')} className="form-input" placeholder="Santos" />
          </div>

          <div>
            <label className="form-label">{t('last_name') || 'Last Name'} *</label>
            <input {...register('last_name')} className="form-input" placeholder="Dela Cruz" />
            {errors.last_name && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>

          <div>
            <label className="form-label">{t('suffix') || 'Suffix'}</label>
            <input {...register('suffix')} className="form-input" placeholder="Jr., Sr., III" />
          </div>

          <div>
            <label className="form-label">{t('settings_dateOfBirth')}</label>
            <input {...register('birthdate')} type="date" className="form-input" />
            {errors.birthdate && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>
          <div>
            <label className="form-label">{t('settings_sex')}</label>
            <select {...register('sex')} className="form-input">
              <option value="">{t('settings_selectSex')}</option>
              <option value="Male">{t('settings_male')}</option>
              <option value="Female">{t('settings_female')}</option>
            </select>
            {errors.sex && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>
          <div>
            <label className="form-label">{t('settings_civilStatus')}</label>
            <select {...register('civil_status')} className="form-input">
              <option value="">{t('settings_selectCivilStatus')}</option>
              <option value="Single">{t('settings_single')}</option>
              <option value="Married">{t('settings_married')}</option>
              <option value="Widowed">{t('settings_widowed')}</option>
              <option value="Separated">{t('settings_separated')}</option>
              <option value="Annulled">{t('settings_annulled')}</option>
            </select>
            {errors.civil_status && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-5 text-[15px]">Address</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">{t('requests_barangay')} *</label>
            <input
              {...register('barangay')}
              className="form-input bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed"
              value={BARANGAY_PAJO}
              readOnly
            />
          </div>
          <div>
            <label className="form-label">Purok *</label>
            <select {...register('purok')} className="form-input">
              <option value="">Select Purok</option>
              {PUROKS_PAJO.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {errors.purok && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">{t('settings_completeAddress')}</label>
            <input {...register('address')} className="form-input" placeholder={t('settings_addressPlaceholder')} />
            {errors.address && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>
          <div>
            <label className="form-label">{t('settings_contactNumber')}</label>
            <input 
              {...register('contact_number')} 
              className="form-input" 
              placeholder={t('settings_contactPlaceholder')} 
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 11)
                e.target.value = val
              }}
            />
            {errors.contact_number && <p className="text-red-500 text-xs mt-1">{errors.contact_number.message}</p>}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-5 text-[15px]">{t('settings_personalDetails')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <input {...register('is_pwd')} type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label className="text-sm font-medium text-[var(--color-text)]">{t('settings_isPwd')}</label>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <input {...register('is_senior')} type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label className="text-sm font-medium text-[var(--color-text)]">{t('settings_isSenior')}</label>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <input {...register('is_4ps')} type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label className="text-sm font-medium text-[var(--color-text)]">{t('settings_is4ps')}</label>
          </div>
          <div>
            <label className="form-label">{t('settings_familySize')}</label>
            <input {...register('family_size')} type="number" className="form-input" />
            {errors.family_size && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">{t('settings_occupation')}</label>
            <input {...register('occupation')} className="form-input" placeholder={t('settings_occupationPlaceholder')} />
            {errors.occupation && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">{t('settings_monthlyIncome')}</label>
            <input {...register('monthly_income')} type="number" step="0.01" className="form-input" />
            {errors.monthly_income && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>}

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="btn btn-secondary px-8 w-full sm:w-auto">{t('cancel')}</button>
        <button type="submit" disabled={saving} className="btn btn-primary px-8 w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  )
}
