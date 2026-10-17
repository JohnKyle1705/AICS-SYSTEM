import React, { useState, useMemo, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ImageBackground,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'
import {
  checkPasswordRequirements,
  calculatePasswordStrength,
  validatePassword,
} from '../lib/passwordValidation'

type Step = 'register' | 'verify' | 'success'

export default function RegisterScreen({ navigation }: any) {
  const [step, setStep] = useState<Step>('register')
  const { colors, isDark } = useTheme()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [otp, setOtp] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cfTouched, setCfTouched] = useState(false)

  useEffect(() => {
    let timer: any
    if (cooldown > 0) timer = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // ── Derived state ──────────────────────────────────────────────────────────
  const requirements = useMemo(() => checkPasswordRequirements(password), [password])
  const strength = useMemo(() => calculatePasswordStrength(password), [password])
  const allMet = useMemo(() => requirements.every(r => r.met), [requirements])
  const firstUnmet = useMemo(() => requirements.find(r => !r.met) || null, [requirements])

  // 2 Columns matching reference image:
  // Col 1: length, lowercase, special
  // Col 2: uppercase, number, no_spaces
  const col1 = useMemo(() => [
    requirements.find(r => r.id === 'length')!,
    requirements.find(r => r.id === 'lowercase')!,
    requirements.find(r => r.id === 'special')!,
  ], [requirements])

  const col2 = useMemo(() => [
    requirements.find(r => r.id === 'uppercase')!,
    requirements.find(r => r.id === 'number')!,
    requirements.find(r => r.id === 'no_spaces')!,
  ], [requirements])

  const confirmMatch = password.length > 0 && password === confirmPassword
  const confirmMismatch = cfTouched && confirmPassword.length > 0 && password !== confirmPassword
  const confirmMatched = cfTouched && confirmPassword.length > 0 && confirmMatch

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    setError('')
    if (!firstName.trim()) return setError('First name is required.')
    if (!lastName.trim()) return setError('Last name is required.')
    if (!email.trim()) return setError('Email address is required.')

    const pwValidation = validatePassword(password)
    if (!pwValidation.isValid) {
      return setError(`Still needed: ${pwValidation.firstUnmet?.label || '8+ characters'}`)
    }

    if (password !== confirmPassword) {
      return setError('Passwords do not match.')
    }

    if (!termsAccepted) {
      return setError('You must agree to the Terms and Conditions.')
    }

    setLoading(true)
    const fullName = `${firstName.trim()} ${lastName.trim()}`

    // Passwords are securely hashed by Supabase Auth backend using bcrypt
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName } }
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (authData.user && !authData.session) {
      setStep('verify')
      setCooldown(60)
      setLoading(false)
    } else if (authData.user && authData.session) {
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        full_name: fullName,
        role: 'resident',
        is_active: false
      }, { onConflict: 'id', ignoreDuplicates: true })
      setStep('success')
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError('')
    if (otp.length < 6) return setError('Please enter the full 6-digit code.')
    setLoading(true)
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: 'signup'
    })
    if (verifyError) { setError(verifyError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        role: 'resident',
        is_active: false
      }, { onConflict: 'id', ignoreDuplicates: true })
      setStep('success')
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (cooldown > 0 || loading) return
    setError('')
    setLoading(true)
    const { error: e } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    if (e) setError(e.message)
    else setCooldown(60)
    setLoading(false)
  }

  const maskEmail = (e: string) => {
    const [name, domain] = e.split('@')
    if (!domain) return e
    return `${name.charAt(0)}${'*'.repeat(Math.max(1, name.length - 1))}@${domain}`
  }

  const s = styles(colors, isDark)

  const getBarColor = (score: number) => {
    if (score === 1) return '#ef4444' // Weak
    if (score <= 3) return '#f59e0b' // Medium
    if (score === 4) return '#3b82f6' // Strong
    return '#10b981' // Very Strong
  }

  return (
    <ImageBackground source={require('../../assets/images/bg_community_service.png')} style={{ flex: 1 }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(2,6,23,0.88)' : 'rgba(255,255,255,0.88)' }]} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Feather name="arrow-left" size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* ── STEP 1 — REGISTER ── */}
            {step === 'register' && (
              <>
                <View style={s.header}>
                  <Text style={s.title}>Create an Account</Text>
                  <Text style={s.subtitle}>Join the AICS Management System</Text>
                </View>

                {/* Name row */}
                <View style={s.nameRow}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={s.label}>FIRST NAME</Text>
                    <TextInput
                      style={s.input}
                      placeholder="Juan"
                      value={firstName}
                      onChangeText={v => { setFirstName(v); setError('') }}
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="words"
                      cursorColor={colors.primary}
                      selectionColor={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={s.label}>LAST NAME</Text>
                    <TextInput
                      style={s.input}
                      placeholder="Dela Cruz"
                      value={lastName}
                      onChangeText={v => { setLastName(v); setError('') }}
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="words"
                      cursorColor={colors.primary}
                      selectionColor={colors.primary}
                    />
                  </View>
                </View>

                {/* Email */}
                <Text style={s.label}>EMAIL ADDRESS</Text>
                <TextInput
                  style={s.input}
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={v => { setEmail(v); setError('') }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={colors.textSecondary}
                  cursorColor={colors.primary}
                  selectionColor={colors.primary}
                />

                {/* ── PASSWORD (Reference image style) ── */}
                <Text style={s.label}>Password</Text>
                <View style={s.pwRoundedBox}>
                  <Feather name="lock" size={18} color="#0f766e" style={{ marginLeft: 14 }} />
                  <TextInput
                    style={s.pwInput}
                    placeholder="Create a password"
                    value={password}
                    onChangeText={v => { setPassword(v); setError('') }}
                    secureTextEntry={!showPassword}
                    placeholderTextColor={colors.textSecondary}
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Password Strength Indicator (Always displayed with 5 bars) */}
                <View style={s.strengthSection}>
                  <View style={s.strengthRow}>
                    <Text style={s.strengthLabel}>Password strength</Text>
                    <Text style={[s.strengthValue, { color: strength.color }]}>
                      {strength.label}
                    </Text>
                  </View>
                  <View style={s.barsRow}>
                    {[0, 1, 2, 3, 4].map(idx => (
                      <View
                        key={idx}
                        style={[
                          s.barSegment,
                          {
                            backgroundColor: idx < strength.score
                              ? getBarColor(strength.score)
                              : (isDark ? '#334155' : '#e2e8f0'),
                          }
                        ]}
                      />
                    ))}
                  </View>
                </View>

                {/* Requirements Section (2 Columns matching reference image) */}
                <View style={s.reqContainer}>
                  <Text style={s.reqHeading}>Your password must include:</Text>
                  <View style={s.reqTwoColumns}>
                    {/* Column 1 */}
                    <View style={s.reqColumn}>
                      {col1.map(req => (
                        <View key={req.id} style={s.reqItem}>
                          <View style={[s.reqCircle, req.met && s.reqCircleMet]}>
                            {req.met && <Feather name="check" size={10} color="#fff" />}
                          </View>
                          <Text style={[s.reqText, req.met && s.reqTextMet]}>
                            {req.label}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Column 2 */}
                    <View style={s.reqColumn}>
                      {col2.map(req => (
                        <View key={req.id} style={s.reqItem}>
                          <View style={[s.reqCircle, req.met && s.reqCircleMet]}>
                            {req.met && <Feather name="check" size={10} color="#fff" />}
                          </View>
                          <Text style={[s.reqText, req.met && s.reqTextMet]}>
                            {req.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Validation message */}
                  <Text style={[s.neededText, allMet && s.neededTextSuccess]}>
                    {allMet
                      ? 'All password requirements met.'
                      : `Still needed: ${firstUnmet?.label || '8+ characters'}`}
                  </Text>
                </View>

                {/* ── CONFIRM PASSWORD (Reference image style) ── */}
                <Text style={[s.label, { marginTop: 14 }]}>Confirm Password</Text>
                <View
                  style={[
                    s.pwRoundedBox,
                    confirmMismatch && { borderColor: '#ef4444' },
                    confirmMatched && { borderColor: '#10b981' },
                  ]}
                >
                  <Feather name="lock" size={18} color="#0f766e" style={{ marginLeft: 14 }} />
                  <TextInput
                    style={s.pwInput}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChangeText={v => {
                      setConfirmPassword(v)
                      setCfTouched(true)
                      setError('')
                    }}
                    onBlur={() => setCfTouched(true)}
                    secureTextEntry={!showConfirm}
                    placeholderTextColor={colors.textSecondary}
                    cursorColor={colors.primary}
                    selectionColor={colors.primary}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name={showConfirm ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {confirmMismatch && (
                  <Text style={s.matchErrText}>Passwords do not match.</Text>
                )}
                {confirmMatched && (
                  <Text style={s.matchSuccessText}>✓ Passwords match.</Text>
                )}

                {/* Terms */}
                <TouchableOpacity style={s.termsRow} onPress={() => setTermsAccepted(v => !v)} activeOpacity={0.7}>
                  <View style={[s.checkbox, termsAccepted && s.checkboxOn]}>
                    {termsAccepted && <Feather name="check" size={11} color="#fff" />}
                  </View>
                  <Text style={s.termsText}>
                    I agree to the <Text style={{ color: colors.primary, fontWeight: '700' }}>Terms and Conditions</Text>
                    {' '}and <Text style={{ color: colors.primary, fontWeight: '700' }}>Privacy Policy</Text> of the AICS System.
                  </Text>
                </TouchableOpacity>

                {!!error && (
                  <View style={s.errBox}>
                    <Feather name="alert-circle" size={13} color="#ef4444" />
                    <Text style={s.errText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.btn, (loading || !allMet || !confirmMatch || !termsAccepted) && s.btnOff]}
                  onPress={handleRegister}
                  disabled={loading || !allMet || !confirmMatch || !termsAccepted}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Sign Up</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={s.linkRow} onPress={() => navigation.navigate('Login')}>
                  <Text style={s.linkTxt}>Already have an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text></Text>
                </TouchableOpacity>

                <Text style={s.footerNote}>Registration is for authorized personnel.{'\n'}New accounts require Admin review.</Text>
              </>
            )}

            {/* ── STEP 2 — VERIFY OTP ── */}
            {step === 'verify' && (
              <View style={s.center}>
                <View style={s.iconCircle}>
                  <Feather name="mail" size={32} color={colors.primary} />
                </View>
                <Text style={s.title}>Verify Your Email</Text>
                <Text style={s.subtitle}>
                  We sent a 6-digit code to{'\n'}
                  <Text style={{ fontWeight: '700', color: colors.text }}>{maskEmail(email)}</Text>
                </Text>

                <Text style={[s.label, { alignSelf: 'flex-start', width: '100%', marginTop: 20 }]}>VERIFICATION CODE</Text>
                <TextInput
                  style={[s.input, s.otpInput]}
                  placeholder="000000"
                  value={otp}
                  onChangeText={t => { setOtp(t.replace(/[^0-9]/g, '')); setError('') }}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor={isDark ? '#475569' : '#cbd5e1'}
                  cursorColor={colors.primary}
                  selectionColor={colors.primary}
                />

                {!!error && (
                  <View style={[s.errBox, { marginBottom: 8 }]}>
                    <Feather name="alert-circle" size={13} color="#ef4444" />
                    <Text style={s.errText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.btn, (loading || otp.length < 6) && s.btnOff, { width: '100%' }]}
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.length < 6}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Verify & Continue</Text>}
                </TouchableOpacity>

                <View style={{ marginTop: 20, alignItems: 'center' }}>
                  <Text style={s.linkTxt}>Didn't receive the code?</Text>
                  <TouchableOpacity onPress={handleResendCode} disabled={cooldown > 0 || loading} style={{ marginTop: 6 }}>
                    <Text style={[s.resendTxt, cooldown > 0 && { color: colors.textSecondary }]}>
                      {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend Code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 3 — SUCCESS ── */}
            {step === 'success' && (
              <View style={s.center}>
                <View style={[s.iconCircle, { backgroundColor: isDark ? '#064e3b' : '#dcfce7', borderColor: isDark ? '#065f46' : '#bbf7d0' }]}>
                  <Feather name="check-circle" size={40} color={isDark ? '#34d399' : '#16a34a'} />
                </View>
                <Text style={s.title}>Verified!</Text>
                <Text style={[s.subtitle, { marginBottom: 28 }]}>
                  Your email has been successfully verified.{'\n'}Please wait for admin approval to log in.
                </Text>
                <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Login')}>
                  <Text style={s.btnTxt}>Back to Login</Text>
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
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 24, elevation: 5, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14 },
  backBtn: { position: 'absolute', top: 18, left: 18, zIndex: 10, padding: 6 },
  header: { alignItems: 'center', marginBottom: 18, marginTop: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  nameRow: { flexDirection: 'row', marginBottom: 0 },
  label: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, backgroundColor: colors.background },
  pwRoundedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.background,
    paddingRight: 10,
  },
  pwInput: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.text,
  },
  eyeBtn: { padding: 8 },
  strengthSection: { marginTop: 8 },
  strengthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  strengthLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  strengthValue: { fontSize: 12, fontWeight: '800' },
  barsRow: { flexDirection: 'row', gap: 6 },
  barSegment: { flex: 1, height: 5, borderRadius: 3 },
  reqContainer: { marginTop: 12 },
  reqHeading: { fontSize: 12, fontWeight: '800', color: colors.text, marginBottom: 8 },
  reqTwoColumns: { flexDirection: 'row', justifyContent: 'space-between' },
  reqColumn: { flex: 1 },
  reqItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reqCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: isDark ? '#64748b' : '#94a3b8',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  reqCircleMet: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  reqText: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
  reqTextMet: { color: isDark ? '#34d399' : '#059669', fontWeight: '700' },
  neededText: { fontSize: 11, fontWeight: '800', color: '#dc2626', marginTop: 4 },
  neededTextSuccess: { color: isDark ? '#34d399' : '#059669' },
  matchErrText: { fontSize: 11, fontWeight: '700', color: '#ef4444', marginTop: 4, marginLeft: 4 },
  matchSuccessText: { fontSize: 11, fontWeight: '700', color: isDark ? '#34d399' : '#059669', marginTop: 4, marginLeft: 4 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14, marginBottom: 4 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  errBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2', borderWidth: 1, borderColor: isDark ? '#7f1d1d' : '#fecaca', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginVertical: 8 },
  errText: { flex: 1, fontSize: 12, color: '#ef4444', fontWeight: '600', lineHeight: 17 },
  btn: { width: '100%', backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12, elevation: 3, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8 },
  btnOff: { opacity: 0.45 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  center: { alignItems: 'center', paddingTop: 16 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', justifyContent: 'center', alignItems: 'center', marginBottom: 18, borderWidth: 1, borderColor: isDark ? '#1d4ed8' : '#bfdbfe' },
  otpInput: { fontSize: 26, fontWeight: '700', textAlign: 'center', letterSpacing: 10, paddingVertical: 16, width: '100%', marginBottom: 10 },
  resendTxt: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  linkRow: { marginTop: 16, alignItems: 'center' },
  linkTxt: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  footerNote: { marginTop: 14, fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 16 },
})
