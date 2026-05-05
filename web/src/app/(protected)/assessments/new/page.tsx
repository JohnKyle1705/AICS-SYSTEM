'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

const schema = z.object({
  interview_date: z.string().min(1, 'Required'),
  findings: z.string().min(5, 'At least 5 characters'),
  recommendation: z.string().min(5, 'At least 5 characters'),
  home_visit: z.boolean(),
})

type FormData = z.infer<typeof schema>

function AssessmentForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('request_id')
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [requestInfo, setRequestInfo] = useState<any>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { home_visit: false },
  })

  useEffect(() => {
    if (!requestId) return
    supabase.from('requests').select('assistance_type, encoded_by, beneficiaries(first_name, last_name)')
      .eq('id', requestId).single().then(({ data }) => setRequestInfo(data))
  }, [requestId])

  const onSubmit = async (data: FormData) => {
    if (!requestId) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err, data: newAssess } = await supabase.from('assessments').insert({
      ...data, request_id: requestId, assessed_by: user?.id,
    }).select().single()
    
    if (err) { setError(err.message); setSaving(false); return }
    
    await supabase.from('requests').update({ assessed_by: user?.id }).eq('id', requestId)
    
    // Log action
    if (user) {
      await supabase.from('system_logs').insert({
        user_id: user.id,
        action: 'CREATE_ASSESSMENT',
        table_name: 'assessments',
        record_id: newAssess?.id,
        details: { request_id: requestId }
      })
    }

    // Notify Resident
    if (requestInfo?.encoded_by) {
      await supabase.from('notifications').insert({
        user_id: requestInfo.encoded_by,
        title: 'Assessment Conducted',
        message: `An assessment has been conducted for your ${requestInfo.assistance_type} request.`,
        type: 'info',
        request_id: requestId
      })
    }

    router.push(`/requests/${requestId}`)
  }

  return (
    <div className="space-y-5 max-w-2xl" id="new-assessment-page">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">New Assessment</h1>
        {requestInfo && (
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
            {requestInfo.beneficiaries?.last_name}, {requestInfo.beneficiaries?.first_name} — {requestInfo.assistance_type}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5">
        <div>
          <label className="form-label">Interview Date *</label>
          <input type="date" {...register('interview_date')} className="form-input" />
          {errors.interview_date && <p className="text-red-500 text-xs mt-1">Required</p>}
        </div>

        <div>
          <label className="form-label">Findings *</label>
          <textarea {...register('findings')} rows={4} className="form-input"
            placeholder="Document interview findings and observations..." />
          {errors.findings && <p className="text-red-500 text-xs mt-1">{errors.findings.message}</p>}
        </div>

        <div>
          <label className="form-label">Recommendation *</label>
          <textarea {...register('recommendation')} rows={3} className="form-input"
            placeholder="Provide recommendation for this request..." />
          {errors.recommendation && <p className="text-red-500 text-xs mt-1">{errors.recommendation.message}</p>}
        </div>

        <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)] cursor-pointer">
          <input type="checkbox" {...register('home_visit')} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
          Home visit conducted
        </label>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Assessment'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}

import { Suspense } from 'react'

export default function NewAssessmentPage() {
  return (
    <Suspense fallback={<div>Loading form...</div>}>
      <AssessmentForm />
    </Suspense>
  )
}
