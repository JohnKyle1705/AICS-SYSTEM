import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Image, ImageBackground,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'

export default function RegisterScreen({ navigation }: any) {
  const [step, setStep] = useState<'register' | 'verify' | 'success'>('register')
  const { colors, isDark } = useTheme()
  
  // Form State
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'resident' | 'encoder'>('resident')
  
  // Verification State
  const [otp, setOtp] = useState('')
  const [cooldown, setCooldown] = useState(0)
  
  // UI State
  const [loading, setLoading] = useState(false)

  // Timer for resend cooldown
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleRegister = async () => {
    if (!fullName || !email || !password) return Alert.alert('Error', 'Please fill in all fields')
    if (password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters')

    setLoading(true)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    })

    if (authError) {
      Alert.alert('Registration Failed', authError.message)
      setLoading(false)
      return
    }

    if (authData.user && !authData.session) {
      setStep('verify')
      setCooldown(60)
      setLoading(false)
    } else if (authData.user && authData.session) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        full_name: fullName,
        role: role,
        is_active: false
      })

      if (profileError) {
        Alert.alert('Error', 'Account created, but profile setup failed: ' + profileError.message)
        setLoading(false)
        return
      }

      setStep('success')
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return Alert.alert('Error', 'Please enter a valid 6-digit code')

    setLoading(true)
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup'
    })

    if (verifyError) {
      Alert.alert('Verification Failed', verifyError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        role: role,
        is_active: false
      })

      if (profileError) {
        Alert.alert('Error', 'Verified, but profile setup failed: ' + profileError.message)
        setLoading(false)
        return
      }

      setStep('success')
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (cooldown > 0) return
    setLoading(true)
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    })

    if (error) {
      Alert.alert('Resend Failed', error.message)
    } else {
      setCooldown(60)
    }
    setLoading(false)
  }

  const maskEmail = (emailStr: string) => {
    if (!emailStr) return ''
    const [name, domain] = emailStr.split('@')
    if (!domain) return emailStr
    return `${name.charAt(0)}${'*'.repeat(Math.max(1, name.length - 1))}@${domain}`
  }

  const s = styles(colors)

  return (
    <ImageBackground source={require('../../assets/images/bg_community_service.png')} style={{ flex: 1 }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(255, 255, 255, 0.85)' }]} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          {step === 'register' && (
            <>
              <View style={s.header}>
                <Text style={s.title}>Create Account</Text>
                <Text style={s.subtitle}>Join the AICS Management System</Text>
              </View>

              <View style={s.roleToggle}>
                <TouchableOpacity 
                  style={[s.roleBtn, role === 'resident' && s.roleBtnActive]}
                  onPress={() => setRole('resident')}
                >
                  <Text style={[s.roleText, role === 'resident' && s.roleTextActive]}>Resident</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[s.roleBtn, role === 'encoder' && s.roleBtnActive]}
                  onPress={() => setRole('encoder')}
                >
                  <Text style={[s.roleText, role === 'encoder' && s.roleTextActive]}>MSWD Staff</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={s.input}
                placeholder="Full Name"
                value={fullName}
                onChangeText={setFullName}
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                style={s.input}
                placeholder="Email Address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                style={s.input}
                placeholder="Password (Min 6 chars)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={colors.textSecondary}
              />

              <TouchableOpacity
                style={[s.button, loading && s.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Sign Up</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'verify' && (
            <View style={s.centerContent}>
              <View style={s.iconCircle}>
                <Feather name="mail" size={32} color={colors.primary} />
              </View>
              <Text style={s.title}>Verify Email</Text>
              <Text style={s.subtitle}>
                We sent a 6-digit code to{'\n'}
                <Text style={{fontWeight: '700', color: colors.text}}>{maskEmail(email)}</Text>
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

              <TouchableOpacity 
                style={s.resendBtn}
                onPress={handleResendCode}
                disabled={cooldown > 0 || loading}
              >
                <Text style={[s.resendText, cooldown > 0 && s.resendTextDisabled]}>
                  {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'success' && (
            <View style={s.centerContent}>
              <View style={[s.iconCircle, { backgroundColor: isDark ? '#064e3b' : '#dcfce7', borderColor: isDark ? '#065f46' : '#bbf7d0' }]}>
                <Feather name="check-circle" size={40} color={isDark ? '#34d399' : '#16a34a'} />
              </View>
              <Text style={s.title}>Success!</Text>
              <Text style={[s.subtitle, { marginBottom: 30 }]}>
                Your account is verified.{'\n'}Please wait for admin approval to login.
              </Text>
              
              <TouchableOpacity
                style={s.button}
                onPress={() => navigation.navigate('Login')}
              >
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

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 32, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15, elevation: 5 },
  backBtn: { position: 'absolute', top: 20, left: 20, zIndex: 10, padding: 5 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 10 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  roleToggle: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 4, marginBottom: 24 },
  roleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  roleBtnActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  roleText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  roleTextActive: { color: colors.primary },
  input: { width: '100%', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text, marginBottom: 12, backgroundColor: colors.background },
  otpInput: { fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: 8, paddingVertical: 16 },
  button: { width: '100%', backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  centerContent: { alignItems: 'center', paddingTop: 20 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  resendBtn: { marginTop: 24 },
  resendText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  resendTextDisabled: { color: colors.textSecondary }
})
