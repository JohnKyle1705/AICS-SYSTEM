import React, { useState, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'
import {
  checkPasswordRequirements,
  calculatePasswordStrength,
  validatePassword,
} from '../lib/passwordValidation'

export default function ForgotPasswordScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()

  const [step, setStep] = useState<'email' | 'code_and_password' | 'success'>('email')

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)

  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // ── Password Validation ───────────────────────────────────────────────────
  const requirements = useMemo(() => checkPasswordRequirements(newPassword), [newPassword])
  const strength = useMemo(() => calculatePasswordStrength(newPassword), [newPassword])
  const allMet = useMemo(() => requirements.every((r) => r.met), [requirements])
  const firstUnmet = useMemo(() => requirements.find((r) => !r.met) || null, [requirements])

  const col1 = useMemo(
    () => [
      requirements.find((r) => r.id === 'length')!,
      requirements.find((r) => r.id === 'lowercase')!,
      requirements.find((r) => r.id === 'special')!,
    ],
    [requirements]
  )

  const col2 = useMemo(
    () => [
      requirements.find((r) => r.id === 'uppercase')!,
      requirements.find((r) => r.id === 'number')!,
      requirements.find((r) => r.id === 'no_spaces')!,
    ],
    [requirements]
  )

  const confirmMatch = newPassword.length > 0 && newPassword === confirmPassword
  const confirmMismatch = confirmTouched && confirmPassword.length > 0 && !confirmMatch
  const confirmMatched = confirmTouched && confirmPassword.length > 0 && confirmMatch

  // ── Step 1: Send Code ────────────────────────────────────────────────────
  const handleRequestCode = async () => {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      return Alert.alert('Required', 'Please enter your email address.')
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail)
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    setStep('code_and_password')
    setResendCooldown(60)
  }

  // ── Resend Code ──────────────────────────────────────────────────────────
  const handleResendCode = async () => {
    if (resendCooldown > 0 || resending) return
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) return

    setResending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail)
    setResending(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Code Sent', 'A new 6-digit code has been sent to your email.')
      setResendCooldown(60)
    }
  }

  // ── Step 2: Verify Code and Update Password ──────────────────────────────
  const handleResetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanCode = code.trim().replace(/\s+/g, '')

    if (!cleanCode) {
      return Alert.alert('Required', 'Please enter the 6-digit code from your email.')
    }

    const pwValidation = validatePassword(newPassword)
    if (!pwValidation.isValid) {
      return Alert.alert(
        'Password Requirements',
        `Still needed: ${pwValidation.firstUnmet?.label || '8+ characters'}`
      )
    }

    if (newPassword !== confirmPassword) {
      return Alert.alert('Mismatch', 'Passwords do not match.')
    }

    setLoading(true)

    // 1. Verify OTP code
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: 'recovery',
    })

    if (otpError) {
      setLoading(false)
      return Alert.alert(
        'Invalid Code',
        otpError.message || 'The code entered is invalid or expired. Please check your email or click Resend code.'
      )
    }

    // 2. Update user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setLoading(false)
      return Alert.alert('Failed', updateError.message)
    }

    // 3. Sign out of recovery session
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ])
    } catch {
      // ignore
    }

    setLoading(false)
    setStep('success')
  }

  const s = styles(colors, isDark)

  return (
    <ImageBackground
      source={require('../../assets/images/bg_community_service.png')}
      style={{ flex: 1 }}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? 'rgba(2, 6, 23, 0.88)' : 'rgba(255, 255, 255, 0.88)' },
        ]}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.card}>

            {/* ═══════════════════════════════════════════════════════════════
                STEP 1: REQUEST EMAIL
               ═══════════════════════════════════════════════════════════════ */}
            {step === 'email' && (
              <>
                <TouchableOpacity
                  style={s.backBtnSquare}
                  onPress={() => navigation.goBack()}
                  accessibilityLabel="Back"
                >
                  <Feather name="arrow-left" size={18} color="#1b4332" />
                </TouchableOpacity>

                <View style={s.headerContainer}>
                  <Text style={s.title}>FORGOT PASSWORD</Text>
                  <View style={s.underlineBar} />
                  <Text style={s.subtitle}>
                    Enter your email to receive a 6-digit password reset code.
                  </Text>
                </View>

                <View style={s.inputWrapper}>
                  <Feather name="mail" size={18} color="#1b4332" style={s.inputIconLeft} />
                  <TextInput
                    style={s.inputWithIcon}
                    placeholder="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <TouchableOpacity
                  style={[s.sageBtn, loading && s.btnDisabled]}
                  onPress={handleRequestCode}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.sageBtnText}>Send Reset Code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.linkRow}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={s.linkText}>
                    Remember your password?{' '}
                    <Text style={{ color: '#2d6a4f', fontWeight: '700' }}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                STEP 2: 6-DIGIT CODE + NEW PASSWORD + CONFIRM (REFERENCE MATCH)
               ═══════════════════════════════════════════════════════════════ */}
            {step === 'code_and_password' && (
              <>
                <TouchableOpacity
                  style={s.backBtnSquare}
                  onPress={() => setStep('email')}
                  accessibilityLabel="Back"
                >
                  <Feather name="arrow-left" size={18} color="#1b4332" />
                </TouchableOpacity>

                <View style={s.headerContainer}>
                  <Text style={s.title}>FORGOT PASSWORD</Text>
                  <View style={s.underlineBar} />
                  <Text style={s.subtitle}>
                    Enter the code sent to{' '}
                    <Text style={{ fontWeight: '700', color: colors.text }}>{email}</Text>, then
                    create your new password.
                  </Text>
                </View>

                {/* Green banner message */}
                <Text style={s.greenMessage}>
                  A 6-digit password reset code was sent to your email.
                </Text>

                {/* 1. 6-Digit Code */}
                <Text style={s.fieldLabel}>6-Digit Code</Text>
                <View style={s.inputWrapper}>
                  <Feather name="key" size={18} color="#1b4332" style={s.inputIconLeft} />
                  <TextInput
                    style={[s.inputWithIcon, { letterSpacing: 4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
                    placeholder="1 2 3 4 5 6"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={8}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                {/* 2. New Password */}
                <Text style={s.fieldLabel}>New Password</Text>
                <View style={s.inputWrapper}>
                  <Feather name="lock" size={18} color="#1b4332" style={s.inputIconLeft} />
                  <TextInput
                    style={s.inputWithIconAndToggle}
                    placeholder="Create a new password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    placeholderTextColor="#94a3b8"
                  />
                  <TouchableOpacity
                    style={s.eyeBtn}
                    onPress={() => setShowPassword((v) => !v)}
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color="#94a3b8"
                    />
                  </TouchableOpacity>
                </View>

                {/* Password Strength Meter */}
                <View style={s.strengthRow}>
                  <Text style={s.strengthLabel}>Password strength</Text>
                  <Text
                    style={[
                      s.strengthValue,
                      { color: newPassword.length === 0 ? '#143d2b' : strength.color },
                    ]}
                  >
                    {newPassword.length === 0 ? 'Not set' : strength.label}
                  </Text>
                </View>

                <View style={s.strengthBarsContainer}>
                  {[0, 1, 2, 3, 4].map((idx) => {
                    let barColor = isDark ? '#334155' : '#e2e8f0'
                    if (idx < strength.score) {
                      if (strength.score === 1) barColor = '#ef4444'
                      else if (strength.score <= 3) barColor = '#f59e0b'
                      else if (strength.score === 4) barColor = '#3b82f6'
                      else barColor = '#10b981'
                    }
                    return (
                      <View
                        key={idx}
                        style={[s.strengthBar, { backgroundColor: barColor }]}
                      />
                    )
                  })}
                </View>

                {/* Requirements 2-Column Grid */}
                <View style={s.requirementsBox}>
                  <Text style={s.requirementsTitle}>Your password must include:</Text>
                  <View style={s.reqGrid}>
                    {/* Left Column */}
                    <View style={s.reqCol}>
                      {col1.map((req) => (
                        <View key={req.id} style={s.reqRow}>
                          <View
                            style={[
                              s.reqCircle,
                              req.met && s.reqCircleMet,
                            ]}
                          >
                            {req.met && <Feather name="check" size={10} color="#fff" />}
                          </View>
                          <Text
                            style={[
                              s.reqText,
                              req.met && { color: '#2d6a4f', fontWeight: '600' },
                            ]}
                          >
                            {req.label}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Right Column */}
                    <View style={s.reqCol}>
                      {col2.map((req) => (
                        <View key={req.id} style={s.reqRow}>
                          <View
                            style={[
                              s.reqCircle,
                              req.met && s.reqCircleMet,
                            ]}
                          >
                            {req.met && <Feather name="check" size={10} color="#fff" />}
                          </View>
                          <Text
                            style={[
                              s.reqText,
                              req.met && { color: '#2d6a4f', fontWeight: '600' },
                            ]}
                          >
                            {req.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Still needed: ... in red */}
                  <View style={{ marginTop: 6 }}>
                    {allMet ? (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#2d6a4f' }}>
                        ✓ All requirements met
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>
                        Still needed: {firstUnmet?.label || '8+ characters'}
                      </Text>
                    )}
                  </View>
                </View>

                {/* 3. Confirm New Password */}
                <Text style={s.fieldLabel}>Confirm New Password</Text>
                <View style={s.inputWrapper}>
                  <Feather name="lock" size={18} color="#1b4332" style={s.inputIconLeft} />
                  <TextInput
                    style={s.inputWithIconAndToggle}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t)
                      setConfirmTouched(true)
                    }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    placeholderTextColor="#94a3b8"
                  />
                  <TouchableOpacity
                    style={s.eyeBtn}
                    onPress={() => setShowConfirmPassword((v) => !v)}
                  >
                    <Feather
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color="#94a3b8"
                    />
                  </TouchableOpacity>
                </View>

                {confirmMismatch && (
                  <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600', marginBottom: 6 }}>
                    Passwords do not match.
                  </Text>
                )}
                {confirmMatched && (
                  <Text style={{ fontSize: 11, color: '#2d6a4f', fontWeight: '600', marginBottom: 6 }}>
                    ✓ Passwords match.
                  </Text>
                )}

                {/* Reset Password Button (Sage Green matching reference) */}
                <TouchableOpacity
                  style={[
                    s.sageBtn,
                    (loading || !allMet || !confirmMatch || !code.trim()) && s.btnDisabled,
                  ]}
                  onPress={handleResetPassword}
                  disabled={loading || !allMet || !confirmMatch || !code.trim()}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={s.btnContentRow}>
                      <Feather name="lock" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={s.sageBtnText}>Reset Password</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Resend Code Link */}
                <TouchableOpacity
                  style={{ marginTop: 14, alignItems: 'center' }}
                  onPress={handleResendCode}
                  disabled={resendCooldown > 0 || resending}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: '#2d6a4f',
                      opacity: resendCooldown > 0 || resending ? 0.6 : 1,
                    }}
                  >
                    {resending
                      ? 'Sending new code...'
                      : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                STEP 3: SUCCESS
               ═══════════════════════════════════════════════════════════════ */}
            {step === 'success' && (
              <View style={s.centerContent}>
                <View style={s.successCircle}>
                  <Feather name="check" size={32} color="#2d6a4f" />
                </View>
                <Text style={s.title}>Password Reset Successfully!</Text>
                <Text style={[s.subtitle, { marginBottom: 20 }]}>
                  Your password has been changed. You can now log in with your new password.
                </Text>
                <TouchableOpacity
                  style={s.sageBtn}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={s.sageBtnText}>Go to Login</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const styles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 6,
      borderWidth: 1,
      borderColor: isDark ? '#1e293b' : '#f1f5f9',
    },
    backBtnSquare: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#e2e8f0',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    headerContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: '#143d2b',
      textAlign: 'center',
    },
    underlineBar: {
      width: 40,
      height: 3.5,
      borderRadius: 2,
      backgroundColor: '#40916c',
      marginTop: 6,
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 12.5,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 8,
    },
    greenMessage: {
      fontSize: 13,
      fontWeight: '600',
      color: '#2d6a4f',
      marginBottom: 16,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    inputWrapper: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    inputIconLeft: {
      position: 'absolute',
      left: 14,
      zIndex: 2,
    },
    inputWithIcon: {
      flex: 1,
      height: 48,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 14,
      paddingLeft: 44,
      paddingRight: 14,
      fontSize: 14,
      color: colors.text,
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
    },
    inputWithIconAndToggle: {
      flex: 1,
      height: 48,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 14,
      paddingLeft: 44,
      paddingRight: 44,
      fontSize: 14,
      color: colors.text,
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
    },
    eyeBtn: {
      position: 'absolute',
      right: 12,
      height: '100%',
      justifyContent: 'center',
      paddingHorizontal: 6,
      zIndex: 2,
    },
    strengthRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    strengthLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    strengthValue: {
      fontSize: 11,
      fontWeight: '800',
    },
    strengthBarsContainer: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 12,
    },
    strengthBar: {
      flex: 1,
      height: 5,
      borderRadius: 3,
    },
    requirementsBox: {
      marginBottom: 12,
    },
    requirementsTitle: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    reqGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    reqCol: {
      flex: 1,
      gap: 5,
    },
    reqRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    reqCircle: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: '#94a3b8',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    reqCircleMet: {
      backgroundColor: '#2d6a4f',
      borderColor: '#2d6a4f',
    },
    reqText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    sageBtn: {
      backgroundColor: '#6b9080',
      borderRadius: 14,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 4,
      shadowColor: '#6b9080',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 3,
    },
    btnDisabled: {
      opacity: 0.55,
    },
    sageBtnText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
    btnContentRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    linkRow: {
      marginTop: 18,
      alignItems: 'center',
    },
    linkText: {
      fontSize: 12.5,
      color: colors.textSecondary,
    },
    centerContent: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    successCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#e8f5e9',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
  })
