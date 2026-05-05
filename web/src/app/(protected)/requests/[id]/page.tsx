'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STATUS_COLORS, REQUEST_STATUSES } from '@/lib/constants'
import { format } from 'date-fns'
import { FileText, Download, CheckCircle, AlertCircle, Clock, XCircle, ClipboardCheck } from 'lucide-react'
import AssessmentForm from '@/components/assessments/AssessmentForm'
import { useLanguage } from '@/lib/LanguageContext'


const STATUS_ICONS: Record<string, any> = {
  Pending: Clock, Approved: CheckCircle, Released: AlertCircle, Declined: XCircle,
}

export default function RequestDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [request, setRequest] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [assessment, setAssessment] = useState<any>(null)
  const [payout, setPayout] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [updating, setUpdating] = useState(false)
  const [isAssessing, setIsAssessing] = useState(false)


  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: req }, { data: docs }, { data: assess }, { data: pay }] = await Promise.all([
        supabase.from('requests').select('*, beneficiaries(*)').eq('id', id).single(),
        supabase.from('request_documents').select('*').eq('request_id', id),
        supabase.from('assessments').select('*').eq('request_id', id).maybeSingle(),
        supabase.from('payouts').select('*').eq('request_id', id).maybeSingle(),
      ])

      if (user) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setProfile(p)

        // Residents can only view their own requests
        if (p?.role === 'resident' && req?.encoded_by !== user.id) {
          router.push('/requests')
          return
        }
      }

      setRequest(req); setDocuments(docs ?? []); setAssessment(assess); setPayout(pay)
      setIsAssessing(false)
    }
    load()
  }, [id])

  const updateStatus = async (status: string) => {
    setUpdating(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('requests').update({
      status, ...(status === 'Approved' ? { approved_by: user?.id } : {}),
    }).eq('id', id)

    // Notify Resident
    if (request.encoded_by) {
      await supabase.from('notifications').insert({
        user_id: request.encoded_by,
        title: `${t('request')} ${status}`,
        message: `${t('notif_requestMsg')} ${status.toLowerCase()}.`,
        type: status === 'Approved' || status === 'Released' ? 'info' : 'pending',
        request_id: id
      })
    }


    setRequest((prev: any) => ({ ...prev, status }))
    setUpdating(false)
  }

  const getDocUrl = async (path: string) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (!request) return (
    <div className="space-y-4 max-w-4xl">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-40" />
      <div className="skeleton h-40" />
    </div>
  )

  const b = request.beneficiaries
  const StatusIcon = STATUS_ICONS[request.status] || Clock

  return (
    <div className="space-y-5 max-w-4xl" id="request-detail-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('requests_details')}</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">ID: {id.slice(0, 8).toUpperCase()}</p>
        </div>

        <span className={`badge ${STATUS_COLORS[request.status]} text-sm px-4 py-1.5 flex items-center gap-1.5`}>
          <StatusIcon size={14} /> {request.status}
        </span>
      </div>

      {/* Beneficiary Info */}
      <div className="card p-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-4 text-[15px]">{t('beneficiary_info')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('beneficiary_name')}</span><span className="font-medium text-[var(--color-text)]">{b?.last_name}, {b?.first_name} {b?.middle_name ?? ''}</span></div>
          <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('beneficiary_sex')}</span><span className="text-[var(--color-text)]">{b?.sex}</span></div>
          <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('beneficiary_barangay')}</span><span className="text-[var(--color-text)]">{b?.barangay}</span></div>
          <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('settings_contactNumber')}</span><span className="text-[var(--color-text)]">{b?.contact_number ?? '—'}</span></div>
          <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('settings_civilStatus')}</span><span className="text-[var(--color-text)]">{b?.civil_status}</span></div>
          <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('settings_dateOfBirth')}</span><span className="text-[var(--color-text)]">{b?.birthdate ? format(new Date(b.birthdate), 'MMM d, yyyy') : '—'}</span></div>
        </div>
      </div>


      {/* Request Info */}
      <div className="card p-6">
        <h2 className="font-semibold text-[var(--color-text)] mb-4 text-[15px]">{t('request_info')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('requests_type')}</span><span className="font-medium text-[var(--color-text)]">{request.assistance_type}</span></div>
          <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('newRequest_amountRequested')}</span><span className="text-[var(--color-text)]">{request.amount_requested ? `₱${Number(request.amount_requested).toLocaleString()}` : '—'}</span></div>
          <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('requests_amount')}</span><span className="text-[var(--color-text)]">{request.amount_approved ? `₱${Number(request.amount_approved).toLocaleString()}` : '—'}</span></div>
          <div className="col-span-2 sm:col-span-3"><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('newRequest_purpose')}</span><p className="text-[var(--color-text)]">{request.purpose}</p></div>
          {request.remarks && <div className="col-span-2 sm:col-span-3"><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('newRequest_remarks')}</span><p className="text-[var(--color-text)]">{request.remarks}</p></div>}
          <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('requests_date')}</span><span className="text-[var(--color-text)]">{format(new Date(request.created_at), 'MMM d, yyyy')}</span></div>
        </div>
      </div>


      {/* Documents */}
      {documents.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-[var(--color-text)] mb-4 text-[15px]">{t('newRequest_stepDocuments')}</h2>

          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-transparent rounded-xl hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <FileText size={14} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-[var(--color-text)]">{doc.file_name}</span>
                </div>
                <button onClick={() => getDocUrl(doc.file_path)} className="text-blue-600 hover:text-blue-800 p-1">
                  <Download size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assessment */}
      {assessment ? (
        <div className="card p-6 border-l-4 border-blue-500">
          <div className="flex justify-between items-start mb-6">
            <h2 className="font-bold text-[var(--color-text)] text-lg flex items-center gap-2">
              <ClipboardCheck className="text-blue-500" /> {t('assessment_result')}
            </h2>

            <div className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest
              ${assessment.priority_level === 'High' ? 'bg-red-100 text-red-600' : 
                assessment.priority_level === 'Medium' ? 'bg-amber-100 text-amber-600' : 
                'bg-blue-100 text-blue-600'}`}>
              {assessment.priority_level} {t('priority')}
            </div>

          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
            <div className="space-y-4">
              <div><span className="text-[var(--color-text-secondary)] text-xs block mb-1">Eligibility</span><span className={`font-bold ${assessment.eligibility_status === 'Eligible' ? 'text-emerald-600' : 'text-red-600'}`}>{assessment.eligibility_status}</span></div>
              <div><span className="text-[var(--color-text-secondary)] text-xs block mb-1">Urgency</span><span className="font-bold text-[var(--color-text)]">{assessment.urgency_level}</span></div>
              <div><span className="text-[var(--color-text-secondary)] text-xs block mb-1">Interview Date</span><span className="text-[var(--color-text)]">{format(new Date(assessment.interview_date), 'MMM d, yyyy')}</span></div>
              <div><span className="text-[var(--color-text-secondary)] text-xs block mb-1">Home Visit</span><span className="text-[var(--color-text)]">{assessment.home_visit ? 'Conducted' : 'Not Conducted'}</span></div>
            </div>
            <div className="space-y-4">
              <div><span className="text-[var(--color-text-secondary)] text-xs block mb-1">{t('assessment_docStatus')}</span><span className="font-bold text-[var(--color-text)]">{assessment.document_status}</span></div>
              <div><span className="text-[var(--color-text-secondary)] text-xs block mb-1">{t('assessment_findings')}</span><p className="text-[var(--color-text)] leading-relaxed italic">"{assessment.findings}"</p></div>
              <div><span className="text-[var(--color-text-secondary)] text-xs block mb-1">{t('assessment_recommendation')}</span><p className="font-bold text-blue-600">{assessment.recommendation}</p></div>
            </div>

          </div>
        </div>
      ) : isAssessing ? (
        <div className="card p-8 border-2 border-blue-500 bg-blue-50/5 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-slate-800">New Eligibility Assessment</h2>
            <button onClick={() => setIsAssessing(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
          </div>
          <AssessmentForm 
            requestId={id} 
            beneficiaryData={request.beneficiaries} 
            onComplete={() => router.refresh()} 
          />
        </div>
      ) : null}

      {/* Payout */}
      {payout && (
        <div className="card p-6">
          <h2 className="font-semibold text-[var(--color-text)] mb-4 text-[15px]">{t('payout_record')}</h2>
          <div className="text-sm space-y-3">
            <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('payout_amount')}</span><span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₱{Number(payout.amount_released).toLocaleString()}</span></div>
            <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('payout_date')}</span><span className="text-[var(--color-text)]">{format(new Date(payout.release_date), 'MMM d, yyyy')}</span></div>
            {payout.acknowledgment_notes && <div><span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">{t('newRequest_remarks')}</span><p className="text-[var(--color-text)]">{payout.acknowledgment_notes}</p></div>}
          </div>
        </div>
      )}


      {/* Actions */}
      {(profile?.role === 'admin' || profile?.role === 'staff') && (
        <div className="card p-6">
          <h2 className="font-semibold text-[var(--color-text)] mb-4 text-[15px]">{t('actions')}</h2>
          <div className="flex flex-wrap gap-2">
            {REQUEST_STATUSES.filter(s => s !== request.status).map(s => (
              <button key={s} onClick={() => updateStatus(s)} disabled={updating}
                className={`btn text-sm disabled:opacity-50
                  ${s === 'Approved' ? 'btn-primary' : s === 'Released' ? 'btn-success' : s === 'Declined' ? 'btn-danger' : 'btn-secondary'}`}>
                {t('markAs')} {s}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 mt-4">
            {!assessment && !isAssessing && (
              <button onClick={() => setIsAssessing(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors">
                + {t('assessment_start')}
              </button>
            )}
            {request.status === 'Approved' && !payout && (
              <button onClick={() => router.push(`/payouts/new?request_id=${id}`)}
                className="text-sm text-emerald-600 hover:text-emerald-800 font-medium hover:underline">
                + {t('payout_record')}
              </button>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
