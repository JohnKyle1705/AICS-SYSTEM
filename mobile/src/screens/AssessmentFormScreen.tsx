import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'

export default function AssessmentFormScreen({ navigation, route }: any) {
  const requestId = route.params?.request_id
  const { colors, isDark } = useTheme()
  const [request, setRequest] = useState<any>(null)
  const [form, setForm] = useState({ 
    interview_date: new Date().toISOString().split('T')[0], 
    findings: '', 
    recommendation: 'Recommend Approval', 
    home_visit: false,
    urgency_level: 'Normal',
    document_status: 'Verified'
  })
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    supabase.from('requests').select('*, beneficiaries(*)').eq('id', requestId).single()
      .then(({ data }) => setRequest(data))
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

    if (form.urgency_level === 'Emergency') score += 25
    else if (form.urgency_level === 'Urgent') score += 15
    else score += 5

    let level = 'Low'
    if (score >= 70) level = 'High'
    else if (score >= 40) level = 'Medium'

    return { score, level, eligible: income <= 30000 }
  }

  const scoring = calculateScore()

  const update = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  const save = async () => {
    if (!form.interview_date || !form.findings || !form.recommendation) {
      return Alert.alert('Error', 'Please fill in required fields')
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('assessments').insert({
      ...form, 
      request_id: requestId, 
      assessed_by: user?.id,
      eligibility_status: scoring.eligible ? 'Eligible' : 'Not Eligible',
      priority_score: scoring.score,
      priority_level: scoring.level
    })
    if (error) { Alert.alert('Error', error.message); setSaving(false); return }
    await supabase.from('requests').update({ status: 'Approved', assessed_by: user?.id }).eq('id', requestId)
    navigation.goBack()
  }

  const s = styles(colors)

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={[s.scoreCard, 
        scoring.level === 'High' ? s.scoreHigh : scoring.level === 'Medium' ? s.scoreMed : s.scoreLow
      ]}>
        <View style={s.scoreHeader}>
          <Text style={s.scoreLabel}>Priority Level</Text>
          <Text style={s.scoreValue}>{scoring.score} pts</Text>
        </View>
        <Text style={s.priorityText}>{scoring.level} Priority</Text>
        <Text style={s.eligibilityText}>
          {scoring.eligible ? '✓ Eligible for Assistance' : '⚠ Over Income Threshold'}
        </Text>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Urgency Level</Text>
        <View style={s.urgencyTabs}>
          {['Normal', 'Urgent', 'Emergency'].map(l => (
            <TouchableOpacity 
              key={l} 
              onPress={() => update('urgency_level', l)}
              style={[s.urgencyBtn, form.urgency_level === l && s.urgencyActive]}
            >
              <Text style={[s.urgencyText, form.urgency_level === l && s.urgencyTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Findings *</Text>
        <TextInput style={[s.input, { height: 100, textAlignVertical: 'top' }]} value={form.findings}
          onChangeText={(v) => update('findings', v)} multiline placeholder="Document findings..." placeholderTextColor={colors.textSecondary} />
      </View>

      <View style={s.field}>
        <Text style={s.label}>Recommendation *</Text>
        <TextInput style={s.input} value={form.recommendation}
          onChangeText={(v) => update('recommendation', v)} placeholderTextColor={colors.textSecondary} />
      </View>

      <TouchableOpacity style={s.checkbox} onPress={() => update('home_visit', !form.home_visit)}>
        <View style={[s.checkBox, form.home_visit && s.checked]}>
          {form.home_visit && <Text style={s.checkMark}>✓</Text>}
        </View>
        <Text style={s.checkLabel}>Home visit conducted</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.8}>
        <Text style={s.saveBtnText}>{saving ? 'Saving...' : 'Save Assessment'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, backgroundColor: colors.card },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  checkBox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.border, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  checkLabel: { fontSize: 14, color: colors.text },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  scoreCard: { padding: 16, borderRadius: 16, marginBottom: 20 },
  scoreLow: { backgroundColor: '#eff6ff' },
  scoreMed: { backgroundColor: '#fff7ed' },
  scoreHigh: { backgroundColor: '#fef2f2' },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  scoreLabel: { fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' },
  scoreValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  priorityText: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 4 },
  eligibilityText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  urgencyTabs: { flexDirection: 'row', gap: 8 },
  urgencyBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.card },
  urgencyActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  urgencyText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  urgencyTextActive: { color: '#fff' },
})
