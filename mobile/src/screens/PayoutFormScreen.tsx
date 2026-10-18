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

  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') {
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
    const releasedAmt = parseFloat(amount)

    // Create payout record
    const { error: payoutErr } = await supabase.from('payouts').insert({
      request_id,
      amount_released: releasedAmt,
      acknowledgment_notes: notes,
      released_by: user?.id,
    })

    if (payoutErr) {
      Alert.alert('Error saving payout', payoutErr.message)
      setSubmitting(false)
      return
    }

    await supabase.from('requests').update({ status: 'Released', release_status: 'Released' }).eq('id', request_id)

    // Deduct from corresponding fund and log transaction
    const { data: req } = await supabase.from('requests').select('encoded_by, assistance_type, amount_approved').eq('id', request_id).single()
    if (req?.assistance_type) {
      const { data: fund } = await supabase.from('funds').select('*').eq('assistance_type', req.assistance_type).single()
      if (fund) {
        const newBalance = Math.max(0, Number(fund.current_balance) - releasedAmt)
        const newReleased = Number(fund.total_released || 0) + releasedAmt
        await supabase.from('funds').update({
          current_balance: newBalance,
          total_released: newReleased
        }).eq('id', fund.id)

        await supabase.from('fund_transactions').insert({
          fund_id: fund.id,
          request_id: request_id,
          transaction_type: 'Release',
          amount: releasedAmt,
          balance_after: newBalance,
          processed_by: user?.id,
          remarks: notes || `Assistance disbursement for Request #${request_id.slice(0, 8).toUpperCase()}`
        })
      }
    }

    // Notify Resident
    if (req?.encoded_by) {
      await supabase.from('notifications').insert({
        user_id: req.encoded_by,
        title: 'Assistance Released',
        message: `Your ${req.assistance_type} assistance payout of ₱${releasedAmt.toLocaleString()} has been released.`,
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
