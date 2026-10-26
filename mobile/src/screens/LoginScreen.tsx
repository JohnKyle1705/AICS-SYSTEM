import React, { useState, useRef } from 'react'
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, 
  ImageBackground, Alert, Image, Animated, Dimensions, Modal
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { height, width } = Dimensions.get('window')

// Bump this version whenever Terms & Conditions are updated.
const TERMS_VERSION = '1.0.0'
const TERMS_ACCEPTED_KEY = 'aics_terms_accepted'

// ── Terms & Conditions Content ──────────────────────────────
const TERMS_SECTIONS = [
  {
    title: 'Purpose of the System',
    icon: '🎯',
    content:
      'This system is intended for the submission, processing, monitoring, and management of AICS (Assistance to Individuals in Crisis Situation) assistance requests under the Department of Social Welfare and Development (DSWD) — Municipality of Daanbantayan, MSWD.',
  },
  {
    title: 'User Responsibility',
    icon: '👤',
    content:
      'Users must provide accurate and truthful information when using this system. Users are also responsible for maintaining the confidentiality of their account credentials. Any activity that occurs under your account is your responsibility.',
  },
  {
    title: 'Privacy and Data Protection',
    icon: '🔒',
    content:
      'All personal information collected through the system shall be handled in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and applicable government regulations. Your data will only be used for the purpose of processing and managing AICS assistance requests.',
  },
  {
    title: 'Document Authenticity',
    icon: '📄',
    content:
      'Users must submit only valid and authentic documents. Submission of false, misleading, or fraudulent information may result in request rejection, account suspension, or legal action under applicable Philippine laws.',
  },
  {
    title: 'Assistance Approval',
    icon: '✅',
    content:
      'Submission of a request does not guarantee approval. All requests are subject to verification, assessment, and availability of government resources. The MSWD office reserves the right to approve, deny, or defer any request based on established criteria and guidelines.',
  },
  {
    title: 'Proper Use of the System',
    icon: '⚖️',
    content:
      'Users shall not attempt to misuse, manipulate, hack, or gain unauthorized access to any part of the system. Any violation of this provision may result in immediate account termination and referral to the appropriate authorities for legal action.',
  },
]

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'admin' | 'resident' | null>(null)
  const [error, setError] = useState('')
  const [fadeAnim] = useState(new Animated.Value(0))
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()

  // Terms & Conditions state
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start()

    // Check if terms were previously accepted
    checkTermsAcceptance()
  }, [fadeAnim])

  async function checkTermsAcceptance() {
    try {
      const stored = await AsyncStorage.getItem(TERMS_ACCEPTED_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.version === TERMS_VERSION && parsed.accepted === true) {
          setTermsAccepted(true)
        }
      }
    } catch {
      // If read fails, default to not accepted
    }
  }

  async function saveTermsAcceptance() {
    try {
      await AsyncStorage.setItem(
        TERMS_ACCEPTED_KEY,
        JSON.stringify({ version: TERMS_VERSION, accepted: true, acceptedAt: new Date().toISOString() })
      )
    } catch {
      // Silently fail
    }
  }

  function handleTermsCheckbox() {
    const newValue = !termsAccepted
    setTermsAccepted(newValue)
    if (newValue && error === 'You must agree to the Terms and Conditions before logging in.') {
      setError('')
    }
  }

  async function signIn() {
    if (!termsAccepted) {
      setError('You must agree to the Terms and Conditions before logging in.')
      return
    }

    try {
      setError('')
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message || 'Login failed. Please try again.')
        Alert.alert(t('error'), error.message)
      } else {
        // Persist terms acceptance on successful login
        await saveTermsAcceptance()
      }
    } catch (err: any) {
      const message = err.message || 'An unexpected error occurred.'
      setError(message)
      Alert.alert(t('error'), message)
    } finally {
      setLoading(false)
    }
  }

  const s = styles(colors)

  return (
    <View style={s.mainWrapper}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[s.container, { opacity: fadeAnim }]}>
            {/* Header Logos */}
            <View style={s.logoContainer}>
              <View style={s.logoBox}>
                <Image 
                  source={require('../../assets/dswd_logo.png')} 
                  style={s.logoImage} 
                />
              </View>
              <View style={s.logoDivider} />
              <View style={s.logoBox}>
                <Image 
                  source={require('../../assets/aics_logo.png')} 
                  style={s.logoImage} 
                />
              </View>
              <View style={s.logoDivider} />
              <View style={[s.logoBox, s.logoBoxWide]}>
                <Image 
                  source={require('../../assets/bagong_pilipinas_logo.png')} 
                  style={s.logoImage} 
                  accessibilityLabel="Bagong Pilipinas Logo"
                />
              </View>
            </View>

            {/* System Title & Subtitle */}
            <View style={s.header}>
              <Text style={s.title}>AICS System</Text>
              <Text style={s.subtitle}>Municipality of Daanbantayan – MSWD</Text>
              <View style={s.decorativeLine} />
              <Text style={s.tagline}>
                Request Management & Beneficiary Information
              </Text>
            </View>

            {/* Login Form Card */}
            <View style={s.formCard}>
              {/* Welcome Section */}
              <Text style={s.welcomeTitle}>Welcome Back</Text>
              <Text style={s.welcomeSubtitle}>Sign in with your credentials</Text>

              {/* Email Field */}
              <View style={s.field}>
                <Text style={s.label}>{t('login_emailAddress')}</Text>
                <View style={s.inputWrapper}>
                  <Feather 
                    name="mail" 
                    size={18} 
                    color="#64748b"
                    style={s.fieldIcon}
                  />
                  <TextInput 
                    style={s.input} 
                    value={email} 
                    onChangeText={setEmail} 
                    autoCapitalize="none"
                    keyboardType="email-address" 
                    placeholder={t('login_emailPlaceholder')} 
                    placeholderTextColor="#94a3b8" 
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View style={s.field}>
                <Text style={s.label}>{t('login_password')}</Text>
                <View style={s.passwordWrapper}>
                  <Feather 
                    name="lock" 
                    size={18} 
                    color="#64748b"
                    style={s.fieldIcon}
                  />
                  <TextInput 
                    style={s.passwordInput} 
                    value={password} 
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder={t('login_passwordPlaceholder')} 
                    placeholderTextColor="#94a3b8"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={s.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Terms & Conditions Checkbox */}
              <View style={s.termsContainer}>
                <TouchableOpacity
                  style={s.termsRow}
                  onPress={handleTermsCheckbox}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <View style={[s.checkbox, termsAccepted && s.checkboxChecked]}>
                    {termsAccepted && (
                      <Feather name="check" size={13} color="#fff" />
                    )}
                  </View>
                  <Text style={s.termsText}>
                    I have read and agree to the{' '}
                    <Text
                      style={s.termsLink}
                      onPress={(e) => {
                        e.stopPropagation?.()
                        setShowTermsModal(true)
                      }}
                    >
                      Terms and Conditions
                    </Text>
                    {' '}and{' '}
                    <Text
                      style={s.termsLink}
                      onPress={(e) => {
                        e.stopPropagation?.()
                        setShowTermsModal(true)
                      }}
                    >
                      Privacy Policy
                    </Text>
                    {' '}of the AICS Request Management and Beneficiary Information System.
                  </Text>
                </TouchableOpacity>

                {!termsAccepted && (
                  <View style={s.termsHint}>
                    <Feather name="file-text" size={11} color="#d97706" />
                    <Text style={s.termsHintText}>
                      Please accept the Terms and Conditions to continue
                    </Text>
                  </View>
                )}
              </View>

              {/* Error Message */}
              {error && (
                <View style={s.errorBox}>
                  <Feather name="alert-circle" size={16} color="#ef4444" />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              {/* Login Button */}
              <TouchableOpacity 
                style={[
                  s.btn, 
                  (!termsAccepted || loading) && s.btnDisabled
                ]} 
                onPress={signIn} 
                disabled={loading || !termsAccepted} 
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={termsAccepted ? '#fff' : '#94a3b8'} size="small" />
                ) : (
                  <View style={s.btnContent}>
                    <Text style={[s.btnText, (!termsAccepted || loading) && s.btnTextDisabled]}>{t('login_signIn')}</Text>
                    <Feather name="arrow-right" size={18} color={termsAccepted ? '#fff' : '#94a3b8'} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Forgot Password */}
              <TouchableOpacity
                style={{ alignItems: 'flex-end', marginTop: 10 }}
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={loading}
              >
                <Text style={{ color: '#0891b2', fontSize: 13, fontWeight: '600' }}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={s.dividerContainer}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>OR CONTINUE AS</Text>
                <View style={s.dividerLine} />
              </View>

              {/* Role Selection */}
              <View style={s.roleContainer}>
                {[
                  { role: 'admin', emoji: '🔐', label: 'Admin' },
                  { role: 'resident', emoji: '👨‍👩‍👧', label: 'Resident' }
                ].map(({ role, emoji, label }) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      s.roleBtn,
                      selectedRole === role && s.roleBtnActive
                    ]}
                    onPress={() => setSelectedRole(role as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.roleEmoji}>{emoji}</Text>
                    <Text style={[s.roleLabel, selectedRole === role && s.roleLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sign Up Link */}
              <View style={s.signupContainer}>
                <Text style={s.signupText}>{t('login_noAccount')} </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Register')}
                  disabled={loading}
                >
                  <Text style={s.signupLink}>{t('login_signUpHere')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Security Notice */}
            <Text style={s.securityNotice}>
              🔒 Secure government system. Authorized access only.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Terms & Conditions Modal */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={s.modalContainer}>
          {/* Modal Header */}
          <View style={s.modalHeader}>
            <View style={s.modalHeaderLeft}>
              <View style={s.modalIconContainer}>
                <Feather name="shield" size={20} color="#fff" />
              </View>
              <View>
                <Text style={s.modalTitle}>Terms and Conditions</Text>
                <Text style={s.modalVersion}>AICS System — v{TERMS_VERSION}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowTermsModal(false)}
              style={s.modalCloseBtn}
              activeOpacity={0.7}
            >
              <Feather name="x" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView 
            style={s.modalScroll}
            contentContainerStyle={s.modalScrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Preamble */}
            <View style={s.preambleBox}>
              <Text style={s.preambleText}>
                By accessing and using the{' '}
                <Text style={s.preambleBold}>
                  AICS Request Management and Beneficiary Information System
                </Text>
                , you acknowledge that you have read, understood, and agree to be bound by the following terms and conditions.
              </Text>
            </View>

            {/* Sections */}
            {TERMS_SECTIONS.map((section, idx) => (
              <View key={idx} style={s.sectionCard}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionIcon}>{section.icon}</Text>
                  <Text style={s.sectionTitle}>
                    {idx + 1}. {section.title}
                  </Text>
                </View>
                <Text style={s.sectionContent}>{section.content}</Text>
              </View>
            ))}

            {/* Footer Notice */}
            <View style={s.noticeBox}>
              <Text style={s.noticeText}>
                <Text style={s.noticeBold}>Note: </Text>
                These terms may be updated from time to time. Continued use of the system after changes constitutes acceptance of the revised terms. You will be prompted to re-accept when terms are updated.
              </Text>
            </View>
          </ScrollView>

          {/* Modal Footer */}
          <View style={s.modalFooter}>
            <TouchableOpacity
              style={s.understoodBtn}
              onPress={() => setShowTermsModal(false)}
              activeOpacity={0.8}
            >
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={s.understoodBtnText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = (colors: any) => StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: { 
    flex: 1, 
    padding: 20, 
    justifyContent: 'center',
    paddingBottom: 40
  },
  
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
    marginTop: Platform.OS === 'ios' ? 20 : 10,
  },
  logoBox: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  // Wide-format logo (Bagong Pilipinas): same card size, less inner padding
  // so it matches the perceived size of the square logos.
  logoBoxWide: {
    padding: 4,
  },
  logoDivider: {
    width: 1.5,
    height: 36,
    backgroundColor: '#cbd5e1',
  },
  
  header: { 
    marginBottom: 24,
    alignItems: 'center'
  },
  title: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#0f172a', 
    marginBottom: 6, 
    letterSpacing: -0.5,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
    textAlign: 'center'
  },
  decorativeLine: {
    width: 40,
    height: 2.5,
    backgroundColor: '#06b6d4',
    marginVertical: 12,
    borderRadius: 2
  },
  tagline: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 280
  },

  formCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },

  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20
  },

  field: { 
    marginBottom: 16,
    gap: 8
  },
  label: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#334155',
    letterSpacing: 0.3
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    paddingHorizontal: 12
  },
  input: { 
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 15, 
    color: '#0f172a',
  },
  fieldIcon: {
    marginRight: 4,
    color: '#64748b'
  },
  passwordWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    paddingHorizontal: 12
  },
  passwordInput: { 
    flex: 1, 
    paddingVertical: 12, 
    paddingHorizontal: 8, 
    fontSize: 15, 
    color: '#0f172a'
  },
  eyeBtn: { 
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },

  // ── Terms & Conditions Styles ──────────────────────
  termsContainer: {
    marginBottom: 16,
    marginTop: 4,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  termsLink: {
    color: '#0891b2',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  termsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  termsHintText: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '600',
  },

  errorBox: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '500',
    flex: 1
  },

  btn: { 
    backgroundColor: '#0891b2',
    borderRadius: 12, 
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0891b2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 48
  },
  btnDisabled: {
    backgroundColor: '#e2e8f0',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center'
  },
  btnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '800',
    letterSpacing: 0.5
  },
  btnTextDisabled: {
    color: '#94a3b8',
  },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 8
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0'
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8
  },

  roleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    justifyContent: 'space-between'
  },
  roleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    gap: 4
  },
  roleBtnActive: {
    backgroundColor: '#ecfeff',
    borderColor: '#0891b2',
  },
  roleEmoji: {
    fontSize: 20
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.2
  },
  roleLabelActive: {
    color: '#0e7490',
  },

  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    gap: 2
  },
  signupText: {
    color: '#64748b',
    fontSize: 13
  },
  signupLink: {
    color: '#0891b2',
    fontSize: 13,
    fontWeight: '700'
  },

  securityNotice: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 11,
    marginBottom: 16,
    paddingHorizontal: 12
  },

  // ── Modal Styles ───────────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0891b2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0891b2',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalVersion: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  preambleBox: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#cffafe',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  preambleText: {
    fontSize: 13,
    color: '#155e75',
    lineHeight: 20,
  },
  preambleBold: {
    fontWeight: '700',
    color: '#0e7490',
  },
  sectionCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  sectionContent: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    paddingLeft: 30,
  },
  noticeBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  noticeText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
  },
  noticeBold: {
    fontWeight: '700',
    color: '#78350f',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  understoodBtn: {
    backgroundColor: '#0891b2',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0891b2',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  understoodBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
})
