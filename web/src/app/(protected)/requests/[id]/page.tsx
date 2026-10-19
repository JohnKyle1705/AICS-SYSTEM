'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STATUS_COLORS, REQUEST_STATUSES } from '@/lib/constants'
import { format } from 'date-fns'
import { FileText, Download, CheckCircle, CheckCircle2, AlertCircle, Clock, XCircle, ClipboardCheck, Banknote, Wallet, RotateCcw } from 'lucide-react'
import AssessmentForm from '@/components/assessments/AssessmentForm'
import { useLanguage } from '@/lib/LanguageContext'


const STATUS_ICONS: Record<string, any> = {
  Pending: Clock, Approved: CheckCircle, Released: AlertCircle, Declined: XCircle,
}

function RequestDetailContent() {
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
  const searchParams = useSearchParams()
  const [highlight, setHighlight] = useState(false)

  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [returnRemarks, setReturnRemarks] = useState('')

  // Admin Approval Modal State
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [approvedAmountInput, setApprovedAmountInput] = useState('')
  const [approvalRemarks, setApprovalRemarks] = useState('')

  const handleConfirmReadiness = async () => {
    if (!request.amount_approved || Number(request.amount_approved) <= 0) {
      alert('Approved amount is missing or zero.')
      return
    }

    const benName = request.beneficiaries ? `${request.beneficiaries.first_name} ${request.beneficiaries.last_name}` : 'the beneficiary'
    if (!confirm(`Confirm readiness for release of ₱${Number(request.amount_approved).toLocaleString()} to ${benName}? This verifies fund allocation and marks the request Ready for Release.`)) {
      return
    }

    setUpdating(true)
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_readiness',
          requestId: id,
          disbursingOfficer: profile?.full_name || 'Municipal Treasurer',
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to confirm readiness')

      alert('Readiness confirmed! Request is now Ready for Release.')
      loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleConfirmRelease = async () => {
    if (!confirm('Confirm disbursement and mark this assistance request as Released? This will record that assistance has been given to the beneficiary, deduct the municipal fund balance, and create payout records.')) {
      return
    }
    setUpdating(true)
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_release',
          requestId: id,
          notes: 'This assistance has been given to the beneficiary.'
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to confirm release')

      alert('Assistance officially released! The transaction is permanently recorded in the municipal ledger.')
      loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleOpenApproveModal = () => {
    setApprovedAmountInput(String(request.amount_approved || request.amount_requested || ''))
    setApprovalRemarks(request.remarks || '')
    setApproveModalOpen(true)
  }

  const handleConfirmApproval = async () => {
    const numAmt = parseFloat(approvedAmountInput)
    if (isNaN(numAmt) || numAmt <= 0) {
      alert('Please enter a valid approved assistance amount greater than ₱0.')
      return
    }

    setUpdating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error: updErr } = await supabase.from('requests').update({
        status: 'Approved',
        release_status: 'Pending Release',
        amount_approved: numAmt,
        approved_by: user?.id,
        remarks: approvalRemarks.trim() || request.remarks || null,
        updated_at: new Date().toISOString()
      }).eq('id', id)

      if (updErr) throw updErr

      // Audit Log
      await supabase.from('system_logs').insert({
        user_id: user?.id,
        action: 'APPROVE_REQUEST',
        table_name: 'requests',
        record_id: id,
        details: { amount_approved: numAmt, release_status: 'Pending Release' }
      })

      // Notify Treasurers: "Pending Release"
      const { data: treasurers } = await supabase.from('profiles').select('id').eq('role', 'treasurer')
      if (treasurers && treasurers.length > 0) {
        const benName = request.beneficiaries ? `${request.beneficiaries.first_name} ${request.beneficiaries.last_name}` : 'Beneficiary'
        await supabase.from('notifications').insert(
          treasurers.map((t: any) => ({
            user_id: t.id,
            title: 'Request Approved (Pending Release)',
            message: `New approved request pending release: ${benName} – ${request.assistance_type} Assistance (₱${numAmt.toLocaleString()}). Request #${id.slice(0, 8).toUpperCase()}.`,
            type: 'info',
            request_id: id,
          }))
        )
      }

      // Notify Resident
      if (request.encoded_by) {
        await supabase.from('notifications').insert({
          user_id: request.encoded_by,
          title: 'Assistance Request Approved',
          message: `Your ${request.assistance_type} assistance request has been approved for ₱${numAmt.toLocaleString()}. Awaiting Treasury release clearance.`,
          type: 'info',
          request_id: id,
        })
      }

      alert('Request approved! Amount recorded and Treasurer notified that request is Pending Release.')
      setApproveModalOpen(false)
      loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeclineRequest = async () => {
    const reason = prompt('Please enter remarks/reason for declining this request:')
    if (reason === null) return
    setUpdating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      await supabase.from('requests').update({
        status: 'Declined',
        remarks: reason.trim() ? `${request.remarks ? request.remarks + ' | ' : ''}Declined: ${reason.trim()}` : request.remarks,
        updated_at: new Date().toISOString()
      }).eq('id', id)

      await supabase.from('system_logs').insert({
        user_id: user?.id,
        action: 'DECLINE_REQUEST',
        table_name: 'requests',
        record_id: id,
        details: { reason: reason.trim() }
      })

      // Notify Resident (Treasurer is NOT notified)
      if (request.encoded_by) {
        await supabase.from('notifications').insert({
          user_id: request.encoded_by,
          title: 'Request Declined',
          message: `Your ${request.assistance_type} assistance request has been declined. ${reason.trim() ? `Reason: ${reason.trim()}` : ''}`,
          type: 'pending',
          request_id: id,
        })
      }

      alert('Request has been declined.')
      loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleReturnSubmit = async () => {
    if (!returnRemarks.trim()) {
      alert('Remarks are required to return this request')
      return
    }
    setUpdating(true)
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'return_request',
          requestId: id,
          remarks: returnRemarks.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to return request')

      alert('Request returned to Admin with remarks.')
      setReturnModalOpen(false)
      loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    if (searchParams.get('highlight') === 'true') {
      setHighlight(true)
      setTimeout(() => {
        document.getElementById('request-detail-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      
      const timer = setTimeout(() => {
        setHighlight(false)
        window.history.replaceState({}, '', `/requests/${id}`)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [searchParams, id])


  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: req }, { data: docs }, { data: assess }, { data: pay }] = await Promise.all([
      supabase.from('requests').select('*, beneficiaries(*), approver:approved_by(full_name)').eq('id', id).single(),
      supabase.from('request_documents').select('*').eq('request_id', id),
      supabase.from('assessments').select('*').eq('request_id', id).maybeSingle(),
      supabase.from('payouts').select('*, profiles:released_by(full_name)').eq('request_id', id).maybeSingle(),
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

  useEffect(() => {
    loadData()
  }, [id])

  const updateStatus = async (status: string) => {
    setUpdating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const updatePayload: any = {
      status, ...(status === 'Approved' ? { approved_by: user?.id } : {}),
    }
    if (status === 'Released') {
      updatePayload.release_status = 'Released'
    }
    await supabase.from('requests').update(updatePayload).eq('id', id)

    if (status === 'Released' && request.amount_approved) {
      const { data: existingPayout } = await supabase.from('payouts').select('id').eq('request_id', id).maybeSingle()
      if (!existingPayout) {
        await supabase.from('payouts').insert({
          request_id: id,
          amount_released: Number(request.amount_approved),
          release_date: new Date().toISOString().split('T')[0],
          released_by: user?.id ?? null,
          acknowledgment_notes: 'Released via Request Details'
        })
      }
    }

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

    // Admin Audit Log and Treasurer Notification
    if (status === 'Approved') {
      // Audit Log for Admin
      await supabase.from('system_logs').insert({
        user_id: user?.id,
        action: 'APPROVE_REQUEST',
        table_name: 'requests',
        record_id: id,
        details: { new_status: status }
      })

      // Notify all Treasurers
      const { data: treasurers } = await supabase.from('profiles').select('id').eq('role', 'treasurer')
      if (treasurers && treasurers.length > 0) {
        const benName = request.beneficiaries ? `${request.beneficiaries.first_name} ${request.beneficiaries.last_name}` : 'Unknown'
        
        const notifications = treasurers.map((t: any) => ({
          user_id: t.id,
          title: 'Ready for Processing',
          message: `New approved request ready for processing: ${benName} – ${request.assistance_type} Assistance – Request #${id.slice(0, 8).toUpperCase()} is now For Release.`,
          type: 'info',
          request_id: id
        }))
        await supabase.from('notifications').insert(notifications)
      }
    }


    setRequest((prev: any) => ({ ...prev, status }))
    setUpdating(false)
  }

  const getDocUrl = async (path: string) => {
    try {
      const res = await fetch(`/api/documents/url?path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (data?.url) {
        window.open(data.url, '_blank')
      } else {
        alert(data?.error || 'Failed to get document link')
      }
    } catch (err) {
      console.error('Error fetching document URL:', err)
      alert('Network error while retrieving document')
    }
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
    <div className={`space-y-5 max-w-4xl transition-all duration-700 ${highlight ? 'ring-4 ring-cyan-500/50 shadow-2xl shadow-cyan-500/20 rounded-2xl p-4 bg-cyan-50/50 dark:bg-cyan-900/10' : ''}`} id="request-detail-page">
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
          {request.assistance_type === 'Burial' && request.extra_fields && (
            <>
              <div>
                <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Name of Deceased</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {request.extra_fields.deceased_name || 
                    [request.extra_fields.deceased_first_name, request.extra_fields.deceased_middle_name, request.extra_fields.deceased_last_name, request.extra_fields.deceased_suffix].filter(Boolean).join(' ') || 
                    '—'}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Relationship to Beneficiary</span>
                <span className="font-medium text-[var(--color-text)]">{request.extra_fields.relationship || '—'}</span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Funeral Home</span>
                <span className="font-medium text-[var(--color-text)]">{request.extra_fields.funeral_home || '—'}</span>
              </div>
            </>
          )}
          {request.assistance_type === 'Medical' && request.extra_fields && (
            <>
              <div>
                <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Hospital / Clinic</span>
                <span className="font-semibold text-[var(--color-text)]">{request.extra_fields.hospital_name || '—'}</span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Diagnosis</span>
                <span className="font-medium text-[var(--color-text)]">{request.extra_fields.diagnosis || '—'}</span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Estimated Cost</span>
                <span className="font-medium text-[var(--color-text)]">{request.extra_fields.estimated_cost ? `₱${Number(request.extra_fields.estimated_cost).toLocaleString()}` : '—'}</span>
              </div>
            </>
          )}
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
              <div><span className="text-[var(--color-text-secondary)] text-xs block mb-1">{t('assessment_findings')}</span><p className="text-[var(--color-text)] leading-relaxed italic">&ldquo;{assessment.findings}&rdquo;</p></div>
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
            onComplete={() => { loadData() }} 
          />
        </div>
      ) : null}

      {/* ── Section 5: Official Release Confirmation Banner ───────── */}
      {(request.status === 'Released' || request.release_status === 'Released') && (
        <div className="card p-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border-2 border-emerald-500 shadow-sm animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <CheckCircle2 size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-600 text-white mb-1.5">
                Official Release Completed
              </span>
              <h2 className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
                This assistance has been given to the beneficiary.
              </h2>
              <p className="text-xs sm:text-sm text-emerald-800/80 dark:text-emerald-300/80 mt-1">
                The authorized municipal administrator has officially disbursed the assistance grant. The transaction is sealed and permanently recorded in the municipal ledger.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800/50 text-xs">
                <div>
                  <span className="text-emerald-700 dark:text-emerald-400 block font-medium">Beneficiary Name</span>
                  <strong className="text-emerald-950 dark:text-emerald-100 text-sm">
                    {b?.first_name} {b?.last_name}
                  </strong>
                </div>
                <div>
                  <span className="text-emerald-700 dark:text-emerald-400 block font-medium">Request Reference</span>
                  <strong className="text-emerald-950 dark:text-emerald-100 font-mono text-sm">
                    #{id.slice(0, 8).toUpperCase()}
                  </strong>
                </div>
                <div>
                  <span className="text-emerald-700 dark:text-emerald-400 block font-medium">Assistance Type</span>
                  <strong className="text-emerald-950 dark:text-emerald-100 text-sm">
                    {request.assistance_type} Assistance
                  </strong>
                </div>
                <div>
                  <span className="text-emerald-700 dark:text-emerald-400 block font-medium">Final Approved Amount</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 text-base font-extrabold">
                    ₱{Number(request.amount_approved || payout?.amount_released || 0).toLocaleString()}
                  </strong>
                </div>
                <div>
                  <span className="text-emerald-700 dark:text-emerald-400 block font-medium">Official Release Date</span>
                  <strong className="text-emerald-950 dark:text-emerald-100">
                    {payout?.release_date
                      ? format(new Date(payout.release_date), 'MMMM d, yyyy')
                      : request.release_date
                      ? format(new Date(request.release_date), 'MMMM d, yyyy')
                      : format(new Date(request.updated_at || request.created_at), 'MMMM d, yyyy')}
                  </strong>
                </div>
                <div>
                  <span className="text-emerald-700 dark:text-emerald-400 block font-medium">Authorized Release Officer</span>
                  <strong className="text-emerald-950 dark:text-emerald-100">
                    {payout?.profiles?.full_name || request.approver?.full_name || 'Authorized MSWDO Admin'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Processing & Status Details */}
      {(payout || request.release_status || request.amount_approved) && (
        <div className="card p-6 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--color-text)] text-[15px] flex items-center gap-2">
              <Banknote className="text-emerald-500" size={18} /> Financial & Clearance Details
            </h2>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              request.release_status === 'Released' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
              request.release_status === 'Ready for Release' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
              'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
            }`}>
              {request.release_status || (payout ? 'Released' : 'Pending Release')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Approved Amount</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                ₱{Number(request.amount_approved || payout?.amount_released || 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Reference Number</span>
              <span className="font-mono text-[var(--color-text)]">
                #{id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Payment Method</span>
              <span className="font-medium text-[var(--color-text)]">
                Cash / Physical Disbursement
              </span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Approved By</span>
              <span className="font-medium text-[var(--color-text)]">
                {request.approver?.full_name || 'MSWDO Admin'}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Release Status</span>
              <span className="font-medium text-[var(--color-text)]">
                {request.release_status || 'Pending Release'}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] text-xs block mb-0.5">Release Date</span>
              <span className="text-[var(--color-text)]">
                {payout?.release_date ? format(new Date(payout.release_date), 'MMM d, yyyy') : request.release_date ? format(new Date(request.release_date), 'MMM d, yyyy') : 'Awaiting Release'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Actions */}
      {(profile?.role === 'admin') && (
        <div className="card p-6">
          <h2 className="font-semibold text-[var(--color-text)] mb-4 text-[15px]">{t('actions')}</h2>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 items-center">
            {request.status === 'Pending' && (
              <>
                <button
                  onClick={handleOpenApproveModal}
                  disabled={updating}
                  className="btn btn-primary text-sm w-full sm:w-auto flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={15} /> Approve Request
                </button>
                <button
                  onClick={handleDeclineRequest}
                  disabled={updating}
                  className="btn btn-danger text-sm w-full sm:w-auto flex items-center justify-center gap-1.5"
                >
                  <XCircle size={15} /> Decline Request
                </button>
              </>
            )}

            {/* Admin Official Release Confirmation */}
            {request.status === 'Approved' && request.release_status !== 'Released' && (
              <button
                onClick={handleConfirmRelease}
                disabled={updating}
                className="btn btn-success text-sm w-full sm:w-auto flex items-center justify-center gap-1.5"
                title="Confirm official release and disburse funds to beneficiary"
              >
                <CheckCircle size={15} /> Confirm Official Release
              </button>
            )}

            {request.status === 'Approved' && request.release_status === 'Ready for Release' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold text-xs border border-amber-200 dark:border-amber-800">
                <CheckCircle size={13} /> Treasurer Confirmed Ready for Release
              </span>
            )}

            {request.status === 'Approved' && request.release_status === 'Pending Release' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-semibold text-xs border border-blue-200 dark:border-blue-800">
                <Clock size={13} /> Awaiting Treasurer Readiness Check
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-4">
            {!assessment && !isAssessing && (
              <button onClick={() => setIsAssessing(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 font-bold bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 rounded-xl hover:bg-blue-100 transition-colors text-center w-full sm:w-auto">
                + {t('assessment_start')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Treasurer Financial Actions */}
      {(profile?.role === 'treasurer') && (
        <div className="card p-6 border-l-4 border-amber-500">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-[var(--color-text)] text-[15px] flex items-center gap-2">
              <Wallet className="text-amber-500" size={18} /> Treasurer Monitoring &amp; Readiness
            </h2>
            <span className="text-xs text-[var(--color-text-secondary)]">Municipal Treasury</span>
          </div>

          {request.status === 'Approved' ? (
            <div className="space-y-4 mt-3">
              <p className="text-sm text-[var(--color-text-secondary)]">
                This request was approved by the MSWDO Admin for <strong className="text-emerald-600 dark:text-emerald-400">₱{Number(request.amount_approved || 0).toLocaleString()}</strong>.
                Verify fund allocation and confirm readiness for the beneficiary to receive assistance.
              </p>

              <div className="flex flex-wrap gap-3 pt-2 items-center">
                {request.release_status !== 'Ready for Release' && request.release_status !== 'Released' && (
                  <button
                    onClick={handleConfirmReadiness}
                    disabled={updating}
                    className="btn btn-primary text-sm flex items-center gap-1.5"
                  >
                    <CheckCircle size={15} /> Confirm Readiness for Release
                  </button>
                )}

                {request.release_status === 'Ready for Release' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold text-xs border border-amber-200 dark:border-amber-800">
                    <CheckCircle size={13} /> Readiness Confirmed · Waiting for Admin to Give Assistance
                  </span>
                )}

                {request.release_status !== 'Released' && (
                  <button
                    onClick={() => setReturnModalOpen(true)}
                    disabled={updating}
                    className="btn btn-danger text-sm flex items-center gap-1.5"
                  >
                    <RotateCcw size={15} /> Return to Admin
                  </button>
                )}

                {request.release_status === 'Released' && (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                    <CheckCircle size={18} /> Assistance has been given to the beneficiary and logged in the Treasury ledger.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300 mt-2">
              <p className="font-medium">Application Status: {request.status}</p>
              <p className="text-xs mt-1 text-amber-700 dark:text-amber-400">
                Treasurers only verify readiness after the MSWDO Admin has officially approved the assistance. Applications can only be approved, declined, or officially released by an Admin.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Admin Approve Request Modal */}
      {approveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--color-border)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-lg font-bold text-emerald-600">Approve Assistance Request</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Beneficiary: {b?.first_name} {b?.last_name} · Requested: ₱{Number(request.amount_requested || 0).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setApproveModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Final Approved Assistance Amount (₱) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input w-full pl-8 font-bold text-base text-emerald-600 dark:text-emerald-400"
                    placeholder="Enter approved amount"
                    value={approvedAmountInput}
                    onChange={(e) => setApprovedAmountInput(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Once approved, the Treasurer will be notified that the request is Pending Release.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Approval Remarks / Casework Notes (Optional)
                </label>
                <textarea
                  className="form-input w-full h-20 text-xs"
                  placeholder="Notes regarding assessment, medical diagnosis, funeral costs, etc."
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={updating || !approvedAmountInput}
                className="btn btn-primary text-sm flex items-center gap-1.5"
              >
                <CheckCircle size={15} />
                {updating ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Admin Modal */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--color-border)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <h3 className="text-lg font-bold text-red-600">Return Request to Admin</h3>
              <button onClick={() => setReturnModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Please state the reason for returning this request (e.g., insufficient fund balance, missing supporting receipt, amount mismatch). The Admin will be notified immediately.
              </p>
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Remarks / Reason *
                </label>
                <textarea
                  className="form-input w-full h-24 text-xs"
                  placeholder="State the reason for return..."
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturnSubmit}
                disabled={updating || !returnRemarks.trim()}
                className="btn btn-danger text-sm"
              >
                {updating ? 'Returning...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RequestDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">Loading request details...</div>}>
      <RequestDetailContent />
    </Suspense>
  )
}
