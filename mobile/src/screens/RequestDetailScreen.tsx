import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { format } from 'date-fns'

const STATUS_COLORS: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  Pending: { bg: '#fef3c7', text: '#92400e', darkBg: '#3d3014', darkText: '#fbbf24' },
  Approved: { bg: '#dbeafe', text: '#1e40af', darkBg: '#142c3d', darkText: '#60a5fa' },
  Released: { bg: '#d1fae5', text: '#065f46', darkBg: '#143d2c', darkText: '#34d399' },
  Declined: { bg: '#fee2e2', text: '#991b1b', darkBg: '#3d1414', darkText: '#f87171' },
}

export default function RequestDetailScreen({ route, navigation }: any) {
  const { id } = route.params
  const { profile } = useAuth()
  const { colors, isDark } = useTheme()
  const [request, setRequest] = useState<any>(null)
  const [assessment, setAssessment] = useState<any>(null)
  const [payout, setPayout] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: req }, { data: assess }, { data: pay }] = await Promise.all([
        supabase.from('requests').select('*, beneficiaries(*)').eq('id', id).single(),
        supabase.from('assessments').select('*').eq('request_id', id).maybeSingle(),
        supabase.from('payouts').select('*').eq('request_id', id).maybeSingle(),
      ])
      setRequest(req); setAssessment(assess); setPayout(pay)
    }
    load()
  }, [id])

  const updateStatus = async (status: string) => {
    Alert.alert('Confirm', `Mark as ${status}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        await supabase.from('requests').update({ status }).eq('id', id)
        setRequest((prev: any) => ({ ...prev, status }))
      }},
    ])
  }

  const s = styles(colors)

  if (!request) return (
    <View style={s.loading}>
      <Text style={{ color: colors.textSecondary }}>Loading...</Text>
    </View>
  )

  const b = request.beneficiaries
  const c = STATUS_COLORS[request.status] ?? STATUS_COLORS.Pending

  const Info = ({ label, value }: { label: string; value: string }) => (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value || '—'}</Text>
    </View>
  )

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={[s.statusBar, { backgroundColor: isDark ? c.darkBg : c.bg }]}>
        <Text style={[s.statusText, { color: isDark ? c.darkText : c.text }]}>{request.status}</Text>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Beneficiary</Text>
        <Info label="Name" value={`${b?.last_name}, ${b?.first_name} ${b?.middle_name ?? ''}`} />
        <Info label="Sex" value={b?.sex} />
        <Info label="Barangay" value={b?.barangay} />
        <Info label="Contact" value={b?.contact_number} />
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Request</Text>
        <Info label="Type" value={request.assistance_type} />
        <Info label="Amount Requested" value={request.amount_requested ? `₱${Number(request.amount_requested).toLocaleString()}` : '—'} />
        <Info label="Amount Approved" value={request.amount_approved ? `₱${Number(request.amount_approved).toLocaleString()}` : '—'} />
        <Info label="Purpose" value={request.purpose} />
        <Info label="Date Filed" value={format(new Date(request.created_at), 'MMM d, yyyy')} />
      </View>

      {assessment && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Assessment</Text>
            <View style={[s.priorityBadge, 
              assessment.priority_level === 'High' ? s.badgeHigh : assessment.priority_level === 'Medium' ? s.badgeMed : s.badgeLow
            ]}>
              <Text style={[s.priorityLabel, 
                assessment.priority_level === 'High' ? s.textHigh : assessment.priority_level === 'Medium' ? s.textMed : s.textLow
              ]}>{assessment.priority_level} PRIORITY</Text>
            </View>
          </View>
          <Info label="Eligibility" value={assessment.eligibility_status} />
          <Info label="Urgency" value={assessment.urgency_level} />
          <Info label="Findings" value={assessment.findings} />
          <Info label="Recommendation" value={assessment.recommendation} />
          <Info label="Home Visit" value={assessment.home_visit ? 'Conducted' : 'Not Conducted'} />
        </View>
      )}

      {payout && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Payout</Text>
          <Info label="Released" value={`₱${Number(payout.amount_released).toLocaleString()}`} />
          <Info label="Date" value={format(new Date(payout.release_date), 'MMM d, yyyy')} />
        </View>
      )}

      {(profile?.role === 'admin' || profile?.role === 'staff') && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Actions</Text>
          <View style={s.actions}>
            {['Pending','Approved','Released','Declined'].filter(st => st !== request.status).map(st => {
              const sc = STATUS_COLORS[st]
              return (
                <TouchableOpacity 
                  key={st} 
                  style={[s.actionBtn, { borderColor: isDark ? sc.darkText : sc.text }]}
                  onPress={() => updateStatus(st)} 
                  activeOpacity={0.7}
                >
                  <Text style={[s.actionText, { color: isDark ? sc.darkText : sc.text }]}>Mark {st}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {!assessment && (
            <TouchableOpacity onPress={() => navigation.navigate('AssessmentForm', { request_id: id })}>
              <Text style={s.linkBtn}>+ Add Assessment</Text>
            </TouchableOpacity>
          )}
          {request.status === 'Approved' && !payout && (
            <TouchableOpacity onPress={() => navigation.navigate('PayoutForm', { request_id: id })}>
              <Text style={[s.linkBtn, { color: colors.success }]}>+ Record Payout</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  statusBar: { borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 16 },
  statusText: { fontWeight: '700', fontSize: 15 },
  section: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeLow: { backgroundColor: '#eff6ff' },
  badgeMed: { backgroundColor: '#fff7ed' },
  badgeHigh: { backgroundColor: '#fef2f2' },
  priorityLabel: { fontSize: 10, fontWeight: '800' },
  textLow: { color: '#2563eb' },
  textMed: { color: '#d97706' },
  textHigh: { color: '#dc2626' },
  infoRow: { marginBottom: 10 },
  infoLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 14, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  actionText: { fontWeight: '600', fontSize: 13 },
  linkBtn: { color: colors.primary, fontWeight: '600', fontSize: 14, marginTop: 12 },
})
