import React, { useState } from 'react'
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, Alert, Image 
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()

  async function signIn() {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        Alert.alert(t('error'), error.message)
      }
    } catch (err: any) {
      Alert.alert(t('error'), err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const s = styles(colors)

  return (
    <ImageBackground source={require('../../assets/images/bg_community_service.png')} style={{ flex: 1 }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(255, 255, 255, 0.85)' }]} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.container}>
            <View style={s.logoContainer}>
              <View style={s.logoBox}>
                <Image source={require('../../assets/dswd_logo.png')} style={s.logoImage} />
              </View>
              <View style={s.logoDivider} />
              <View style={s.logoBox}>
                <Image source={require('../../assets/aics_logo.png')} style={s.logoImage} />
              </View>
            </View>
            <View style={s.header}>
              <Text style={s.title}>AICS Portal</Text>
              <Text style={s.subtitle}>{t('login_signInToContinue')}</Text>
            </View>

          <View style={s.form}>
            <View style={s.field}>
              <Text style={s.label}>{t('login_emailAddress')}</Text>
              <TextInput 
                style={s.input} 
                value={email} 
                onChangeText={setEmail} 
                autoCapitalize="none"
                keyboardType="email-address" 
                placeholder={t('login_emailPlaceholder')} 
                placeholderTextColor={colors.textSecondary} 
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>{t('login_password')}</Text>
              <View style={s.passwordWrapper}>
                <TextInput 
                  style={s.passwordInput} 
                  value={password} 
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder={t('login_passwordPlaceholder')} 
                  placeholderTextColor={colors.textSecondary} 
                />
                <TouchableOpacity
                  style={s.eyeBtn}
                  onPress={() => setShowPassword(v => !v)}
                  activeOpacity={0.7}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[s.btn, loading && { opacity: 0.7 }]} 
              onPress={signIn} 
              disabled={loading} 
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('login_signIn')}</Text>}
            </TouchableOpacity>

            <View style={s.footer}>
              <Text style={s.footerText}>{t('login_noAccount')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={s.link}>{t('login_signUpHere')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const styles = (colors: any) => StyleSheet.create({
  container: { flex: 1, padding: 32, justifyContent: 'center' },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  logoDivider: {
    width: 2,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '900', color: colors.text, marginBottom: 8, letterSpacing: -1 },
  subtitle: { fontSize: 16, color: colors.textSecondary, lineHeight: 22 },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  input: { borderWidth: 2, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, backgroundColor: colors.card },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, overflow: 'hidden' },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  btn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 10, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 },
  footerText: { color: colors.textSecondary, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '700' },
})
