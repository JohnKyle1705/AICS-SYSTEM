import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ImageBackground,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'

type Step = 'register' | 'verify' | 'success'

export default function RegisterScreen({ navigation }: any) {
  const [step, setStep] = useState<Step>('register')
  const { colors, isDark } = useTheme()

  // Form State
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Verification State
  const [otp, setOtp] = useState('')
  const [cooldown, setCooldown] = useState(0)

  // UI State
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let timer: any
    if (cooldown > 0) timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleRegister = async () => {
    if (!fullName || !password || !email) return Alert.alert('Error', 'Please fill in all fields')
    if (password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters')

    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })

    if (authError) { Alert.alert('Registration Failed', authError.message); setLoading(false); return }

    if (authData.user && !authData.session) {
      setStep('verify')
      setCooldown(60)
      setLoading(false)
    } else if (authData.user && authData.session) {
      await supabase.from('profiles').upsert({
        id: authData.user.id, full_name: fullName, role: 'resident', is_active: false
      }, { onConflict: 'id', ignoreDuplicates: true })
      setStep('success')
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return Alert.alert('Error', 'Please enter a valid 6-digit code')
    setLoading(true)

    const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' })
    if (verifyError) { Alert.alert('Verification Failed', verifyError.message); setLoading(false); return }
    
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id, full_name: fullName, role: 'resident', is_active: false
      }, { onConflict: 'id', ignoreDuplicates: true })
      setStep('success')
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (cooldown > 0) return
    setLoading(true)
    
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) Alert.alert('Resend Failed', error.message)
    else setCooldown(60)
    
    setLoading(false)
  }

  const maskEmail = (e: string) => {
    const [name, domain] = e.split('@')
    if (!domain) return e
    return `${name.charAt(0)}${'*'.repeat(Math.max(1, name.length - 1))}@${domain}`
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

            {/* ── STEP 1: REGISTER ── */}
            {step === 'register' && (
              <>
                <View style={s.header}>
                  <Text style={s.title}>Create Account</Text>
                  <Text style={s.subtitle}>Join the AICS Management System</Text>
                </View>

                <TextInput style={s.input} placeholder="Full Name" value={fullName} onChangeText={setFullName} placeholderTextColor={colors.textSecondary} />
                <TextInput style={s.input} placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.textSecondary} />

                <View style={s.passwordRow}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Password (Min 6 chars)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.eyeBtn}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={{ height: 12 }} />

                <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={handleRegister} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Sign Up</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={s.linkRow} onPress={() => navigation.navigate('Login')}>
                  <Text style={s.linkText}>Already have an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text></Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 2: VERIFY OTP ── */}
            {step === 'verify' && (
              <View style={s.centerContent}>
                <View style={s.iconCircle}>
                  <Feather name={'mail'} size={32} color={colors.primary} />
                </View>
                <Text style={s.title}>Verify Email</Text>
                <Text style={s.subtitle}>
                  We sent a 6-digit code to{'\n'}
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    {maskEmail(email)}
                  </Text>
                </Text>

                <TextInput
                  style={[s.input, s.otpInput]}
                  placeholder="000000"
                  value={otp}
                  onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor={isDark ? '#475569' : '#cbd5e1'}
                />

                <TouchableOpacity
                  style={[s.button, (loading || otp.length < 6) && s.buttonDisabled, { width: '100%' }]}
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.length < 6}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Verify & Continue</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={s.resendBtn} onPress={handleResendCode} disabled={cooldown > 0 || loading}>
                  <Text style={[s.resendText, cooldown > 0 && s.resendTextDisabled]}>
                    {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 3: SUCCESS ── */}
            {step === 'success' && (
              <View style={s.centerContent}>
                <View style={[s.iconCircle, { backgroundColor: isDark ? '#064e3b' : '#dcfce7', borderColor: isDark ? '#065f46' : '#bbf7d0' }]}>
                  <Feather name="check-circle" size={40} color={isDark ? '#34d399' : '#16a34a'} />
                </View>
                <Text style={s.title}>Success!</Text>
                <Text style={[s.subtitle, { marginBottom: 30 }]}>
                  Your email has been verified.{'\n'}Please wait for admin approval to login.
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
  otpInput: { fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: 8, paddingVertical: 16 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, marginBottom: 0, paddingRight: 12 },
  eyeBtn: { padding: 8 },
  button: { width: '100%', backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  centerContent: { alignItems: 'center', paddingTop: 20 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: isDark ? '#1d4ed8' : '#bfdbfe' },
  resendBtn: { marginTop: 20 },
  resendText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  resendTextDisabled: { color: colors.textSecondary },
  linkRow: { marginTop: 20, alignItems: 'center' },
  linkText: { fontSize: 13, color: colors.textSecondary },
})
