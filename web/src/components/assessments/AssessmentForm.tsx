'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculatePriority } from '@/lib/scoring'
import { Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'

interface AssessmentFormProps {
  requestId: string;
  beneficiaryData: {
    monthly_income: number;
    family_size: number;
    is_pwd: boolean;
    is_senior: boolean;
    is_4ps: boolean;
  };
  onComplete: () => void;
}

export default function AssessmentForm({ requestId, beneficiaryData, onComplete }: AssessmentFormProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [urgency, setUrgency] = useState<'Normal' | 'Urgent' | 'Emergency'>('Normal')
  const [findings, setFindings] = useState('')
  const [recommendation, setRecommendation] = useState('Recommend Approval')
  const [docStatus, setDocStatus] = useState('Verified')
  const [homeVisit, setHomeVisit] = useState(false)

  const scoring = calculatePriority({
    monthlyIncome: beneficiaryData.monthly_income,
    familySize: beneficiaryData.family_size,
    isPwd: beneficiaryData.is_pwd,
    isSenior: beneficiaryData.is_senior,
    is4ps: beneficiaryData.is_4ps,
    urgency
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase.from('assessments').insert({
      request_id: requestId,
      interview_date: new Date().toISOString().split('T')[0],
      findings,
      recommendation,
      home_visit: homeVisit,
      assessed_by: user?.id,
      eligibility_status: scoring.isEligible ? 'Eligible' : 'Not Eligible',
      urgency_level: urgency,
      priority_score: scoring.score,
      priority_level: scoring.level,
      document_status: docStatus
    })

    if (!error) {
      await supabase.from('requests').update({ status: 'Approved' }).eq('id', requestId)
      onComplete()
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scoring Summary */}
        <div className={`p-5 rounded-2xl border-2 flex flex-col justify-between
          ${scoring.level === 'High' ? 'bg-red-50 border-red-100 text-red-700' : 
            scoring.level === 'Medium' ? 'bg-amber-50 border-amber-100 text-amber-700' : 
            'bg-blue-50 border-blue-100 text-blue-700'}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">Automated Priority</span>
              <span className="text-xl font-black">{scoring.score} pts</span>
            </div>
            <h3 className="text-2xl font-black mb-1">{scoring.level} Priority</h3>
            <p className="text-xs opacity-80 leading-relaxed">
              Based on income (₱{beneficiaryData.monthly_income}), family size ({beneficiaryData.family_size}), and status.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            {scoring.isEligible ? (
              <ShieldCheck size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span className="text-sm font-bold">{scoring.isEligible ? 'Passed Eligibility Check' : 'Failed Eligibility Check'}</span>
          </div>
        </div>

        {/* Urgency & Docs */}
        <div className="space-y-4">
          <div>
            <label className="form-label">Urgency Level</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {['Normal', 'Urgent', 'Emergency'].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setUrgency(l as any)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border-2
                    ${urgency === l 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Document Verification</label>
            <select 
              value={docStatus} 
              onChange={(e) => setDocStatus(e.target.value)}
              className="form-input text-sm"
            >
              <option value="Verified">Verified & Complete</option>
              <option value="Incomplete">Incomplete Documents</option>
              <option value="Invalid">Invalid / Fraudulent</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="form-label">Key Findings</label>
          <textarea
            required
            rows={3}
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            className="form-input text-sm"
            placeholder="Describe the beneficiary's current situation..."
          />
        </div>
        <div>
          <label className="form-label">Staff Recommendation</label>
          <select 
            value={recommendation} 
            onChange={(e) => setRecommendation(e.target.value)}
            className="form-input text-sm"
          >
            <option value="Recommend Approval">Recommend Approval</option>
            <option value="Recommend Rejection">Recommend Rejection</option>
            <option value="Request Additional Information">Request Additional Information</option>
          </select>
        </div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={homeVisit}
            onChange={(e) => setHomeVisit(e.target.checked)}
            className="w-5 h-5 rounded-lg border-slate-300 text-blue-600"
          />
          <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Physical Home Visit Conducted</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full btn btn-primary py-4 rounded-2xl shadow-xl shadow-blue-500/20"
      >
        {saving ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={18} /> Complete Assessment</>}
      </button>
    </form>
  )
}
