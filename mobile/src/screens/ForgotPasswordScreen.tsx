import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ImageBackground,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'

type Step = 'request' | 'success'

export default function ForgotPasswordScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const [step, setStep] = useState<Step>('request')

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const maskEmail = (e: string) => {
    const [name, domain] = e.split('@')
    if (!domain) return e
    return `${name.charAt(0)}${'*'.repeat(Math.max(1, name.length - 1))}@${domain}`
  }

  const handleRequest = async () => {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) return Alert.alert('Error', 'Please enter your email address')

    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail)
    if (error) {
      Alert.alert('Failed', error.message)
    } else {
      setStep('success')
    }
    setLoading(false)
  }

  const s = styles(colors, isDark)

  return (
    <ImageBackground source={require('../../assets/images/bg_community_service.png')} style={{ flex: 1 }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(2, 6, 23, 0.88)' : 'rgba(255, 255, 255, 0.88)' }]} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Feather name="arrow-left" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* ── STEP 1: REQUEST ── */}
            {step === 'request' && (
              <>
                <View style={s.header}>
                  <View style={s.iconCircle}>
                    <Feather name="shield" size={28} color={colors.primary} />
                  </View>
                  <Text style={s.title}>Reset Password</Text>
                  <Text style={s.subtitle}>Enter your email to receive a password reset link</Text>
                </View>

                <TextInput style={s.input} placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.textSecondary} />

                <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={handleRequest} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Send Reset Link</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={s.linkRow} onPress={() => navigation.goBack()}>
                  <Text style={s.linkText}>Remember your password? <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text></Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── SUCCESS ── */}
            {step === 'success' && (
              <View style={s.centerContent}>
                <View style={[s.iconCircle, { backgroundColor: isDark ? '#064e3b' : '#dcfce7', borderColor: isDark ? '#065f46' : '#bbf7d0' }]}>
                  <Feather name="check-circle" size={40} color={isDark ? '#34d399' : '#16a34a'} />
                </View>
                <Text style={s.title}>Check Your Email!</Text>
                <Text style={[s.subtitle, { marginBottom: 24 }]}>
                  A reset link has been sent to{'\n'}
                  <Text style={{ fontWeight: '700', color: colors.text }}>{maskEmail(email)}</Text>
                  {'\n\n'}Open the link to set your new password.
                </Text>
                <TouchableOpacity style={s.button} onPress={() => navigation.navigate('Login')}>
                  <Text style={s.buttonText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 32, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15, elevation: 5 },
  backBtn: { position: 'absolute', top: 20, left: 20, zIndex: 10, padding: 5 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 10 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  input: { width: '100%', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text, marginBottom: 12, backgroundColor: colors.background },
  button: { width: '100%', backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  centerContent: { alignItems: 'center', paddingTop: 20 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#1d4ed8' : '#bfdbfe' },
  linkRow: { marginTop: 20, alignItems: 'center' },
  linkText: { fontSize: 13, color: colors.textSecondary },
})
