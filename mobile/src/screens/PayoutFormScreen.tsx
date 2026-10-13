import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'

export default function PayoutFormScreen({ route, navigation }: any) {
  const { request_id } = route.params || {}
  const { profile } = useAuth()
  const { colors } = useTheme()
  
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const s = styles(colors)

  if (profile?.role !== 'admin') {
    return (
      <View style={s.centerContainer}>
        <Text style={s.errorText}>Unauthorized Access</Text>
      </View>
    )
  }

  const handleSubmit = async () => {
    if (!amount) return Alert.alert('Error', 'Amount is required')
    
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Create payout record
    const { error: payoutErr } = await supabase.from('payouts').insert({
      request_id,
      amount_released: parseFloat(amount),
      acknowledgment_notes: notes,
      released_by: user?.id,
    })

    if (payoutErr) {
      Alert.alert('Error saving payout', payoutErr.message)
      setSubmitting(false)
      return
    }

    await supabase.from('requests').update({ status: 'Released', release_status: 'Released' }).eq('id', request_id)

    // Notify Resident
    const { data: req } = await supabase.from('requests').select('encoded_by, assistance_type').eq('id', request_id).single()
    if (req?.encoded_by) {
      await supabase.from('notifications').insert({
        user_id: req.encoded_by,
        title: 'Assistance Released',
        message: `Your ${req.assistance_type} assistance payout of ₱${parseFloat(amount).toLocaleString()} has been released.`,
        type: 'info',
        request_id
      })
    }

    if (user) {
      await supabase.from('system_logs').insert({
        user_id: user.id,
        action: 'CREATE_PAYOUT',
        table_name: 'payouts',
        record_id: request_id
      })
    }

    Alert.alert('Success', 'Payout recorded successfully', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ])
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.label}>Amount Released (₱) *</Text>
      <TextInput
        style={s.input}
        keyboardType="numeric"
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={s.label}>Acknowledgment Notes (Optional)</Text>
      <TextInput
        style={[s.input, s.textArea]}
        multiline
        numberOfLines={4}
        placeholder="Any additional notes..."
        value={notes}
        onChangeText={setNotes}
        textAlignVertical="top"
        placeholderTextColor={colors.textSecondary}
      />

      <TouchableOpacity
        style={[s.btnSubmit, submitting && s.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={s.btnText}>Record Payout</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.textSecondary },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text, marginBottom: 20 },
  textArea: { height: 100 },
  btnSubmit: { backgroundColor: colors.success || '#10b981', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
})
