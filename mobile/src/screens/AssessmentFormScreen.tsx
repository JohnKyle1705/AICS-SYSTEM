import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useAuth } from '../lib/AuthContext'
import { Feather } from '@expo/vector-icons'

export default function AssessmentFormScreen({ navigation, route }: any) {
  const requestId = route.params?.request_id
  const { colors, isDark } = useTheme()
  const { profile } = useAuth()

  const [request, setRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm'>('form')

  // Form State
  const [interviewDate, setInterviewDate] = useState(new Date().toISOString().split('T')[0])
  const [interviewTime, setInterviewTime] = useState(new Date().toTimeString().slice(0, 5))
  const [assessorName, setAssessorName] = useState('')
  const [assessorDesignation, setAssessorDesignation] = useState('Social Welfare Officer')
  const [urgency, setUrgency] = useState<'Normal' | 'Urgent' | 'Emergency'>('Normal')
  const [eligibility, setEligibility] = useState<'Eligible' | 'Not Eligible'>('Eligible')
  const [docStatus, setDocStatus] = useState('Verified')
  const [documentsReviewed, setDocumentsReviewed] = useState('')
  const [findings, setFindings] = useState('')
  const [recommendation, setRecommendation] = useState<'Approve' | 'Decline'>('Approve')
  const [recommendedAmount, setRecommendedAmount] = useState('')
  const [justification, setJustification] = useState('')
  const [homeVisit, setHomeVisit] = useState(false)

  useEffect(() => {
    if (profile?.full_name) {
      setAssessorName(profile.full_name)
    }
  }, [profile])

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('*, beneficiaries(*)')
          .eq('id', requestId)
          .single()
        if (error) throw error
        setRequest(data)
        if (data?.amount_requested) {
          setRecommendedAmount(String(data.amount_requested))
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to load request')
      } finally {
        setLoading(false)
      }
    }
    if (requestId) fetchRequest()
  }, [requestId])

  const calculateScore = () => {
    if (!request?.beneficiaries) return { score: 0, level: 'Low', eligible: true }
    const b = request.beneficiaries
    let score = 0
    const income = Number(b.monthly_income) || 0
    const familySize = Number(b.family_size) || 1

    if (income <= 5000) score += 40
    else if (income <= 10000) score += 30
    else if (income <= 15000) score += 20
    else if (income <= 20000) score += 10

    if (familySize >= 7) score += 20
    else if (familySize >= 5) score += 15
    else if (familySize >= 3) score += 10

    if (b.is_pwd) score += 5
    if (b.is_senior) score += 5
    if (b.is_4ps) score += 5

    if (urgency === 'Emergency') score += 25
    else if (urgency === 'Urgent') score += 15
    else score += 5

    let level = 'Low'
    if (score >= 70) level = 'High'
    else if (score >= 40) level = 'Medium'

    return { score, level, eligible: income <= 30000 }
  }

  const scoring = calculateScore()

  const validate = (): string | null => {
    if (!assessorName.trim()) return 'Assessor name is required.'
    if (!assessorDesignation.trim()) return 'Assessor designation is required.'
    if (!interviewDate) return 'Interview date is required.'
    if (!findings.trim()) return 'Findings and situation verification is required.'
    if (!justification.trim()) return 'Justification / remarks is required.'
    if (recommendation === 'Approve') {
      const amt = parseFloat(recommendedAmount)
      if (!recommendedAmount || isNaN(amt) || amt < 0) {
        return 'Recommended amount must be a valid non-negative number.'
      }
    }
    return null
  }

  const handleReview = () => {
    const err = validate()
    if (err) {
      Alert.alert('Incomplete Form', err)
      return
    }
    setStep('confirm')
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      Alert.alert('Incomplete Form', err)
      setStep('form')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be logged in to submit an assessment.')

      // Check if assessment already exists
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
        findings.trim(),
        `--- Assessment Details ---`,
        `Priority: ${scoring.level} (${scoring.score} pts)`,
        `Urgency: ${urgency}`,
        `Eligibility: ${eligibility}`,
        `Documents: ${docStatus}`,
      ].join('\n')

      // Insert assessment record — DOES NOT AUTO-APPROVE REQUEST!
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

      // Link assessor to request (preserving status as Pending for decision-maker)
      await supabase.from('requests').update({ assessed_by: user.id }).eq('id', requestId)

      // Audit Log
      await supabase.from('system_logs').insert({
        user_id: user.id,
        action: 'ASSESSMENT_SUBMITTED',
        table_name: 'assessments',
        record_id: requestId,
        details: {
          request_ref: requestId?.slice(0, 8).toUpperCase(),
          assessor: assessorName.trim(),
          recommendation,
          eligibility,
          priority: scoring.level,
        },
      })

      Alert.alert(
        'Assessment Submitted',
        'Assessment completed successfully. The request can now be reviewed by the decision-maker for final approval or decline.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      )
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit assessment.')
    } finally {
      setSaving(false)
    }
  }

  const s = styles(colors, isDark)

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const b = request?.beneficiaries
  const benName = b ? `${b.first_name || ''} ${b.last_name || ''}`.trim() : 'Unknown Beneficiary'
  const refNum = `#${requestId?.slice(0, 8).toUpperCase()}`

  // ─────────────────────────────────────────────────────────────
  // CONFIRMATION STEP
  // ─────────────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.confirmHeader}>
          <Feather name="clipboard" size={28} color={colors.primary} />
          <Text style={s.confirmTitle}>Review & Confirm Assessment</Text>
          <Text style={s.confirmSub}>
            Please review the documented details before final submission. Once submitted, assessments cannot be silently altered.
          </Text>
        </View>

        <View style={s.summaryCard}>
          <Row label="Request Reference" value={refNum} colors={colors} />
          <Row label="Beneficiary" value={benName} colors={colors} />
          <Row label="Assistance Type" value={`${request?.assistance_type || ''} Assistance`} colors={colors} />
          <Row label="Assessor" value={`${assessorName} (${assessorDesignation})`} colors={colors} />
          <Row label="Interview Date/Time" value={`${interviewDate} ${interviewTime}`} colors={colors} />
          <Row label="Eligibility" value={eligibility} colors={colors} highlight={eligibility === 'Eligible' ? '#10b981' : '#ef4444'} />
          <Row label="Priority" value={`${scoring.level} (${scoring.score} pts)`} colors={colors} />
          <Row label="Recommendation" value={recommendation} colors={colors} highlight={recommendation === 'Approve' ? '#10b981' : '#ef4444'} />
          {recommendation === 'Approve' && (
            <Row label="Recommended Amount" value={`₱${parseFloat(recommendedAmount || '0').toLocaleString()}`} colors={colors} highlight="#10b981" />
          )}
          <Row label="Document Status" value={docStatus} colors={colors} />
          <Row label="Home Visit" value={homeVisit ? 'Conducted' : 'Not Conducted'} colors={colors} />

          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border }}>
            <Text style={s.fieldLabel}>Findings:</Text>
            <Text style={s.fieldValBox}>{findings}</Text>
          </View>

          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border }}>
            <Text style={s.fieldLabel}>Justification / Remarks:</Text>
            <Text style={s.fieldValBox}>{justification}</Text>
          </View>
        </View>

        <View style={s.policyNote}>
          <Feather name="info" size={16} color="#2563eb" style={{ marginTop: 2 }} />
          <Text style={s.policyText}>
            Submitting this assessment does not auto-approve the request. The final decision remains with the authorized decision-maker.
          </Text>
        </View>

        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => setStep('form')}
            disabled={saving}
          >
            <Text style={[s.btnText, { color: colors.text }]}>Back & Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.primary, flex: 2 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[s.btnText, { color: '#fff' }]}>Confirm & Submit</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // FORM STEP
  // ─────────────────────────────────────────────────────────────
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header Info */}
      <View style={s.headerCard}>
        <View style={s.headerCol}>
          <Text style={s.headerLabel}>Request Ref</Text>
          <Text style={s.headerValBold}>{refNum}</Text>
        </View>
        <View style={s.headerCol}>
          <Text style={s.headerLabel}>Beneficiary</Text>
          <Text style={s.headerValBold} numberOfLines={1}>{benName}</Text>
        </View>
        <View style={s.headerCol}>
          <Text style={s.headerLabel}>Category</Text>
          <Text style={s.headerValBold}>{request?.assistance_type} Assistance</Text>
        </View>
      </View>

      {/* Priority Scoring Banner */}
      <View style={[s.scoreCard, scoring.level === 'High' ? s.scoreHigh : scoring.level === 'Medium' ? s.scoreMed : s.scoreLow]}>
        <View style={s.scoreHeader}>
          <Text style={s.scoreLabel}>Automated Priority Score</Text>
          <Text style={s.scoreValue}>{scoring.score} pts</Text>
        </View>
        <Text style={s.priorityText}>{scoring.level} Priority</Text>
        <Text style={s.eligibilityText}>
          {scoring.eligible ? '✓ Meets Standard Criteria' : '⚠ Over Income Threshold'}
        </Text>
      </View>

      {/* Assessor Details */}
      <Text style={s.sectionTitle}>Assessor Information</Text>
      <View style={s.field}>
        <Text style={s.label}>Assessor&apos;s Name *</Text>
        <TextInput
          style={s.input}
          value={assessorName}
          onChangeText={setAssessorName}
          placeholder="Full name of assessing officer"
          placeholderTextColor={colors.textSecondary}
        />
      </View>
      <View style={s.field}>
        <Text style={s.label}>Designation *</Text>
        <TextInput
          style={s.input}
          value={assessorDesignation}
          onChangeText={setAssessorDesignation}
          placeholder="e.g. Social Welfare Officer"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {/* Interview Details */}
      <Text style={[s.sectionTitle, { marginTop: 16 }]}>Interview &amp; Verification</Text>
      <View style={s.rowFields}>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.label}>Interview Date *</Text>
          <TextInput
            style={s.input}
            value={interviewDate}
            onChangeText={setInterviewDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.label}>Interview Time</Text>
          <TextInput
            style={s.input}
            value={interviewTime}
            onChangeText={setInterviewTime}
            placeholder="HH:MM"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      {/* Urgency Level */}
      <View style={s.field}>
        <Text style={s.label}>Urgency Level</Text>
        <View style={s.tabRow}>
          {(['Normal', 'Urgent', 'Emergency'] as const).map(l => (
            <TouchableOpacity
              key={l}
              onPress={() => setUrgency(l)}
              style={[s.tabBtn, urgency === l && s.tabBtnActive]}
            >
              <Text style={[s.tabBtnText, urgency === l && s.tabBtnTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Eligibility Assessment */}
      <View style={s.field}>
        <Text style={s.label}>Eligibility Assessment *</Text>
        <View style={s.tabRow}>
          {(['Eligible', 'Not Eligible'] as const).map(e => (
            <TouchableOpacity
              key={e}
              onPress={() => setEligibility(e)}
              style={[
                s.tabBtn,
                eligibility === e && (e === 'Eligible' ? s.tabEligibleActive : s.tabNotEligibleActive)
              ]}
            >
              <Text style={[s.tabBtnText, eligibility === e && { color: '#fff' }]}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Document Verification */}
      <View style={s.field}>
        <Text style={s.label}>Document Verification Status</Text>
        <View style={s.tabRow}>
          {['Verified', 'Incomplete', 'Invalid'].map(d => (
            <TouchableOpacity
              key={d}
              onPress={() => setDocStatus(d)}
              style={[s.tabBtn, docStatus === d && s.tabBtnActive]}
            >
              <Text style={[s.tabBtnText, docStatus === d && s.tabBtnTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Documents Reviewed</Text>
        <TextInput
          style={s.input}
          value={documentsReviewed}
          onChangeText={setDocumentsReviewed}
          placeholder="e.g. Medical certificate, valid ID, Barangay certificate"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {/* Findings */}
      <View style={s.field}>
        <Text style={s.label}>Findings &amp; Situation Verification *</Text>
        <TextInput
          style={[s.input, { height: 110, textAlignVertical: 'top' }]}
          value={findings}
          onChangeText={setFindings}
          multiline
          placeholder="Document the beneficiary's situation, circumstances, and interview notes…"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {/* Recommendation */}
      <Text style={[s.sectionTitle, { marginTop: 16 }]}>Assessor&apos;s Recommendation</Text>
      <View style={s.field}>
        <View style={s.tabRow}>
          {(['Approve', 'Decline'] as const).map(r => (
            <TouchableOpacity
              key={r}
              onPress={() => setRecommendation(r)}
              style={[
                s.tabBtn,
                recommendation === r && (r === 'Approve' ? s.tabEligibleActive : s.tabNotEligibleActive)
              ]}
            >
              <Text style={[s.tabBtnText, recommendation === r && { color: '#fff' }]}>
                {r === 'Approve' ? 'Recommend Approval' : 'Recommend Decline'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
          ⚠️ Assessor recommendation only. Decision-maker will make the final decision.
        </Text>
      </View>

      {recommendation === 'Approve' && (
        <View style={s.field}>
          <Text style={s.label}>Recommended Assistance Amount (₱) *</Text>
          <TextInput
            style={s.input}
            value={recommendedAmount}
            onChangeText={setRecommendedAmount}
            keyboardType="numeric"
            placeholder="e.g. 5000"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      )}

      {/* Justification */}
      <View style={s.field}>
        <Text style={s.label}>Justification &amp; Remarks *</Text>
        <TextInput
          style={[s.input, { height: 80, textAlignVertical: 'top' }]}
          value={justification}
          onChangeText={setJustification}
          multiline
          placeholder="Explain justification for recommendation. If declining, state specific reason."
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {/* Home Visit Switch */}
      <View style={s.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.switchLabel}>Physical Home Visit Conducted</Text>
          <Text style={s.switchSub}>Check if a home or on-site verification visit was conducted.</Text>
        </View>
        <Switch
          value={homeVisit}
          onValueChange={setHomeVisit}
          trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
          thumbColor={homeVisit ? colors.primary : '#f8fafc'}
        />
      </View>

      {/* Submit Action */}
      <TouchableOpacity
        style={s.submitBtn}
        onPress={handleReview}
        activeOpacity={0.8}
      >
        <Text style={s.submitBtnText}>Review &amp; Confirm Assessment</Text>
        <Feather name="arrow-right" size={18} color="#fff" />
      </TouchableOpacity>
    </ScrollView>
  )
}

function Row({ label, value, colors, highlight }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: highlight || colors.text, textAlign: 'right', flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  headerCol: { flex: 1, alignItems: 'center' },
  headerLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 2 },
  headerValBold: { fontSize: 12, fontWeight: '700', color: colors.text },

  scoreCard: { padding: 16, borderRadius: 16, marginBottom: 20 },
  scoreLow: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  scoreMed: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fde68a' },
  scoreHigh: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  scoreLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  scoreValue: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  priorityText: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  eligibilityText: { fontSize: 12, fontWeight: '600', color: '#475569' },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
  },
  rowFields: { flexDirection: 'row', gap: 10 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  tabBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  tabEligibleActive: { borderColor: '#10b981', backgroundColor: '#10b981' },
  tabNotEligibleActive: { borderColor: '#ef4444', backgroundColor: '#ef4444' },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tabBtnTextActive: { color: '#fff' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  switchLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  switchSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Confirm Step Styles
  confirmHeader: { alignItems: 'center', marginVertical: 16 },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 8 },
  confirmSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  fieldValBox: {
    fontSize: 12,
    color: colors.text,
    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    lineHeight: 18,
  },
  policyNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  policyText: { fontSize: 11, color: '#1e40af', flex: 1, lineHeight: 16 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 14, fontWeight: '700' },
})
