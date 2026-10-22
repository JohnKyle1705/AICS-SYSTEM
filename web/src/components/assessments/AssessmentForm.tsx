'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculatePriority } from '@/lib/scoring'
import {
  Loader2, CheckCircle2, AlertTriangle, ShieldCheck,
  ClipboardCheck, User, Calendar, FileText, ChevronRight, ChevronLeft,
} from 'lucide-react'

interface AssessmentFormProps {
  requestId: string
  requestRef: string
  assistanceType: string
  beneficiaryData: {
    first_name?: string
    last_name?: string
    monthly_income?: number
    family_size?: number
    is_pwd?: boolean
    is_senior?: boolean
    is_4ps?: boolean
  }
  onComplete: () => void
}

export default function AssessmentForm({
  requestId,
  requestRef,
  assistanceType,
  beneficiaryData,
  onComplete,
}: AssessmentFormProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [error, setError] = useState('')

  // Form fields
  const [interviewDate, setInterviewDate] = useState(new Date().toISOString().split('T')[0])
  const [interviewTime, setInterviewTime] = useState(
    new Date().toTimeString().slice(0, 5)
  )
  const [assessorName, setAssessorName] = useState('')
  const [assessorDesignation, setAssessorDesignation] = useState('Social Welfare Officer')
  const [urgency, setUrgency] = useState<'Normal' | 'Urgent' | 'Emergency'>('Normal')
  const [findings, setFindings] = useState('')
  const [eligibility, setEligibility] = useState<'Eligible' | 'Not Eligible'>('Eligible')
  const [docStatus, setDocStatus] = useState('Verified')
  const [documentsReviewed, setDocumentsReviewed] = useState('')
  const [homeVisit, setHomeVisit] = useState(false)
  const [recommendation, setRecommendation] = useState<'Approve' | 'Decline'>('Approve')
  const [justification, setJustification] = useState('')
  const [recommendedAmount, setRecommendedAmount] = useState('')

  // Auto-compute priority score
  const scoring = calculatePriority({
    monthlyIncome: beneficiaryData.monthly_income ?? 0,
    familySize: beneficiaryData.family_size ?? 1,
    isPwd: beneficiaryData.is_pwd ?? false,
    isSenior: beneficiaryData.is_senior ?? false,
    is4ps: beneficiaryData.is_4ps ?? false,
    urgency,
  })

  const benName = `${beneficiaryData.first_name ?? ''} ${beneficiaryData.last_name ?? ''}`.trim()

  // ─────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!assessorName.trim()) return 'Assessor name is required.'
    if (!assessorDesignation.trim()) return 'Assessor designation is required.'
    if (!interviewDate) return 'Interview date is required.'
    if (!findings.trim()) return 'Findings and situation verification is required.'
    if (!justification.trim()) return 'Justification / additional remarks is required.'
    if (recommendation === 'Decline' && !justification.trim())
      return 'Justification is required when declining.'
    if (recommendation === 'Approve') {
      const amt = parseFloat(recommendedAmount)
      if (!recommendedAmount || isNaN(amt) || amt < 0)
        return 'Recommended amount must be a valid non-negative number.'
    }
    return null
  }

  const handleNext = () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setStep('confirm')
  }

  // ─────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); setStep('form'); return }

    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be logged in to submit an assessment.')

      // Check no assessment already exists
      const { data: existing } = await supabase
        .from('assessments')
        .select('id')
        .eq('request_id', requestId)
        .eq('assessment_status', 'submitted')
        .maybeSingle()

      if (existing) {
        throw new Error('An assessment has already been submitted for this request.')
      }

      const enrichedFindings = [
        findings,
        `--- Assessment Details ---`,
        `Priority: ${scoring.level} (${scoring.score} pts)`,
        `Urgency: ${urgency}`,
        `Eligibility: ${eligibility}`,
        `Documents: ${docStatus}`,
      ].join('\n')

      // Insert assessment (does NOT change request status — that is the decision-maker's job)
      const { error: assessErr } = await supabase.from('assessments').insert({
        request_id: requestId,
        interview_date: interviewDate,
        interview_time: interviewTime || null,
        findings: enrichedFindings,
        recommendation,
        justification: justification.trim(),
        recommended_amount: recommendation === 'Approve' ? parseFloat(recommendedAmount) : null,
        home_visit: homeVisit,
        assessed_by: user.id,
        assessor_name: assessorName.trim(),
        assessor_designation: assessorDesignation.trim(),
        documents_reviewed: documentsReviewed.trim() || null,
        urgency_level: urgency,
        priority_level: scoring.level,
        priority_score: scoring.score,
        eligibility_status: eligibility,
        document_status: docStatus,
        assessment_status: 'submitted',
        submitted_at: new Date().toISOString(),
      })

      if (assessErr) throw assessErr

      // Update request's assessed_by (does NOT change status)
      await supabase.from('requests').update({ assessed_by: user.id }).eq('id', requestId)

      // Audit log
      await supabase.from('system_logs').insert({
        user_id: user.id,
        action: 'ASSESSMENT_SUBMITTED',
        table_name: 'assessments',
        record_id: requestId,
        details: {
          request_ref: requestRef,
          assessor: assessorName.trim(),
          recommendation,
          eligibility,
          priority: scoring.level,
        },
      })

      onComplete()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit assessment.')
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CONFIRMATION STEP
  // ─────────────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <ClipboardCheck size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text)] text-base">Confirm Assessment Submission</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Review carefully — submitted assessments cannot be silently edited.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <Row label="Request Ref" value={`#${requestRef}`} />
            <Row label="Beneficiary" value={benName} />
            <Row label="Assistance Type" value={assistanceType} />
            <Row label="Assessor" value={`${assessorName} — ${assessorDesignation}`} />
            <Row label="Interview Date" value={`${interviewDate} ${interviewTime}`} />
            <Row label="Eligibility" value={eligibility} highlight={eligibility === 'Eligible' ? 'green' : 'red'} />
            <Row label="Priority Level" value={`${scoring.level} (${scoring.score} pts)`} />
            <Row label="Recommendation" value={recommendation} highlight={recommendation === 'Approve' ? 'green' : 'red'} />
            {recommendation === 'Approve' && <Row label="Recommended Amount" value={`₱${parseFloat(recommendedAmount).toLocaleString()}`} highlight="green" />}
            <Row label="Documents Reviewed" value={docStatus} />
            <Row label="Home Visit" value={homeVisit ? 'Conducted' : 'Not Conducted'} />
            <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
              <span className="text-xs text-[var(--color-text-secondary)] block mb-1">Findings</span>
              <p className="text-[var(--color-text)] text-xs leading-relaxed bg-white dark:bg-slate-800 rounded-xl p-3 border border-[var(--color-border)]">
                {findings}
              </p>
            </div>
            <div>
              <span className="text-xs text-[var(--color-text-secondary)] block mb-1">Justification / Remarks</span>
              <p className="text-[var(--color-text)] text-xs leading-relaxed bg-white dark:bg-slate-800 rounded-xl p-3 border border-[var(--color-border)]">
                {justification}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-xs text-blue-700 dark:text-blue-300">
          <strong>Important:</strong> Submitting this assessment does <em>not</em> automatically approve or decline the request.
          The authorized decision-maker must review this assessment and make the final decision.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep('form')}
            disabled={saving}
            className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <ChevronLeft size={15} /> Back & Edit
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {saving ? 'Submitting…' : 'Confirm & Submit Assessment'}
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // FORM STEP
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-[var(--color-border)] text-sm">
        <div>
          <span className="text-xs text-[var(--color-text-secondary)] block mb-0.5">Request Reference</span>
          <span className="font-mono font-bold text-[var(--color-text)]">#{requestRef}</span>
        </div>
        <div>
          <span className="text-xs text-[var(--color-text-secondary)] block mb-0.5">Beneficiary</span>
          <span className="font-semibold text-[var(--color-text)]">{benName}</span>
        </div>
        <div>
          <span className="text-xs text-[var(--color-text-secondary)] block mb-0.5">Assistance Category</span>
          <span className="font-semibold text-[var(--color-text)]">{assistanceType} Assistance</span>
        </div>
      </div>

      {/* Priority Score */}
      <div className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4
        ${scoring.level === 'High' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400' :
          scoring.level === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400' :
          'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400'}`}>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider opacity-70">Automated Priority Score</span>
          <h3 className="text-2xl font-black mt-0.5">{scoring.level} Priority — {scoring.score} pts</h3>
          <p className="text-xs opacity-80 mt-1">Based on income, family size, PWD/Senior/4Ps status, and urgency.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {scoring.isEligible ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-bold">
            {scoring.isEligible ? 'Passed Eligibility Check' : 'Failed Eligibility Check'}
          </span>
        </div>
      </div>

      {/* Assessor Info */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)] flex items-center gap-1.5">
          <User size={13} /> Assessor Information
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="form-label">Assessor&apos;s Name *</label>
            <input
              type="text"
              required
              value={assessorName}
              onChange={(e) => setAssessorName(e.target.value)}
              className="form-input text-sm"
              placeholder="Full name of the assessing officer"
            />
          </div>
          <div>
            <label className="form-label">Designation *</label>
            <select
              value={assessorDesignation}
              onChange={(e) => setAssessorDesignation(e.target.value)}
              className="form-input text-sm"
            >
              <option>Social Welfare Officer</option>
              <option>Social Worker</option>
              <option>MSWD Officer</option>
              <option>Municipal Social Welfare & Development Officer</option>
              <option>Case Worker</option>
            </select>
          </div>
        </div>
      </div>

      {/* Interview Details */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)] flex items-center gap-1.5">
          <Calendar size={13} /> Assessment / Interview Details
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="form-label">Interview Date *</label>
            <input
              type="date"
              required
              value={interviewDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setInterviewDate(e.target.value)}
              className="form-input text-sm"
            />
          </div>
          <div>
            <label className="form-label">Interview Time</label>
            <input
              type="time"
              value={interviewTime}
              onChange={(e) => setInterviewTime(e.target.value)}
              className="form-input text-sm"
            />
          </div>
        </div>
      </div>

      {/* Urgency & Eligibility */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Urgency Level</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {(['Normal', 'Urgent', 'Emergency'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setUrgency(l)}
                className={`py-2 rounded-xl text-xs font-bold transition-all border-2
                  ${urgency === l
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-300'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Eligibility Assessment *</label>
          <select
            value={eligibility}
            onChange={(e) => setEligibility(e.target.value as 'Eligible' | 'Not Eligible')}
            className="form-input text-sm"
          >
            <option value="Eligible">Eligible — Meets AICS criteria</option>
            <option value="Not Eligible">Not Eligible — Does not meet criteria</option>
          </select>
        </div>
      </div>

      {/* Document Verification */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Document Verification Status</label>
          <select
            value={docStatus}
            onChange={(e) => setDocStatus(e.target.value)}
            className="form-input text-sm"
          >
            <option value="Verified">Verified &amp; Complete</option>
            <option value="Incomplete">Incomplete — Requires Additional Docs</option>
            <option value="Invalid">Invalid / Fraudulent</option>
          </select>
        </div>
        <div>
          <label className="form-label">Documents Reviewed</label>
          <input
            type="text"
            value={documentsReviewed}
            onChange={(e) => setDocumentsReviewed(e.target.value)}
            className="form-input text-sm"
            placeholder="e.g. Medical cert, barangay cert, ID"
          />
        </div>
      </div>

      {/* Findings */}
      <div>
        <label className="form-label">
          <FileText size={13} className="inline mr-1" />
          Findings &amp; Situation Verification *
        </label>
        <textarea
          required
          rows={4}
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          className="form-input text-sm"
          placeholder="Describe the beneficiary's current situation, circumstances verified, and supporting information gathered during the interview or home visit…"
        />
      </div>

      {/* Recommendation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Assessor&apos;s Recommendation *</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(['Approve', 'Decline'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRecommendation(r)}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all border-2
                  ${recommendation === r
                    ? r === 'Approve'
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg'
                      : 'bg-red-600 border-red-600 text-white shadow-lg'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-2">
            ⚠️ This is a <strong>recommendation</strong> only. The authorized decision-maker makes the final decision.
          </p>
        </div>

        {recommendation === 'Approve' && (
          <div>
            <label className="form-label">Recommended Assistance Amount (₱) *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={recommendedAmount}
              onChange={(e) => setRecommendedAmount(e.target.value)}
              className="form-input text-sm"
              placeholder="e.g. 5000"
            />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Subject to fund availability and decision-maker approval.
            </p>
          </div>
        )}
      </div>

      {/* Justification */}
      <div>
        <label className="form-label">Justification &amp; Additional Remarks *</label>
        <textarea
          required
          rows={3}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          className="form-input text-sm"
          placeholder="Explain the basis for your recommendation. If declining, provide a clear and specific reason."
        />
      </div>

      {/* Home Visit */}
      <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-[var(--color-border)]">
        <input
          type="checkbox"
          checked={homeVisit}
          onChange={(e) => setHomeVisit(e.target.checked)}
          className="w-5 h-5 rounded-lg border-slate-300 text-blue-600"
        />
        <div>
          <span className="text-sm font-medium text-[var(--color-text)]">Physical Home Visit Conducted</span>
          <p className="text-xs text-[var(--color-text-secondary)]">Check if a home/site visit was conducted as part of this assessment.</p>
        </div>
      </label>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleNext}
        className="w-full btn btn-primary py-4 rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"
      >
        <ChevronRight size={18} /> Review &amp; Confirm Assessment
      </button>
    </div>
  )
}

// Small helper component for confirmation rows
function Row({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: 'green' | 'red'
}) {
  return (
    <div className="flex justify-between items-start gap-3 py-1 border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs text-[var(--color-text-secondary)] shrink-0">{label}</span>
      <span
        className={`text-xs font-semibold text-right ${
          highlight === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
          highlight === 'red' ? 'text-red-600 dark:text-red-400' :
          'text-[var(--color-text)]'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
