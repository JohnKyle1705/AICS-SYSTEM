import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
} from 'react-native'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'

export default function PendingScreen() {
  const { signOut, refreshProfile } = useAuth()
  const { colors, isDark } = useTheme()
  const [checking, setChecking] = useState(false)
  const [stillPending, setStillPending] = useState(false)

  const handleCheckStatus = async () => {
    setChecking(true)
    setStillPending(false)
    try {
      const updated = await refreshProfile()
      if (!updated || !updated.is_active) {
        setStillPending(true)
      }
      // If updated.is_active is true, AuthContext updates `profile`,
      // which automatically re-renders AppNavigator to the Main Dashboard!
    } catch {
      setStillPending(true)
    } finally {
      setChecking(false)
    }
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
          {
            backgroundColor: isDark
              ? 'rgba(2, 6, 23, 0.88)'
              : 'rgba(255, 255, 255, 0.90)',
          },
        ]}
      />
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          {/* Header Icon */}
          <View style={s.iconCircle}>
            <Feather
              name="alert-triangle"
              size={36}
              color={isDark ? '#fbbf24' : '#d97706'}
            />
          </View>

          <Text style={s.title}>Account Pending Approval</Text>
          <Text style={s.subtitle}>
            Your account has been successfully created, but it requires
            administrator approval before you can access the system. Please
            contact your system administrator to activate your account.
          </Text>

          {/* Warning Banner if still pending */}
          {stillPending && (
            <View style={s.warningBanner}>
              <Feather
                name="alert-circle"
                size={20}
                color={isDark ? '#f87171' : '#dc2626'}
                style={{ marginTop: 2 }}
              />
              <Text style={s.warningText}>
                Your account is still awaiting administrator approval. Please try
                again later.
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.primaryBtn, checking && s.btnDisabled]}
              onPress={handleCheckStatus}
              disabled={checking}
            >
              {checking ? (
                <View style={s.btnContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.primaryBtnText}>Checking Status...</Text>
                </View>
              ) : (
                <View style={s.btnContent}>
                  <Feather name="refresh-cw" size={18} color="#fff" />
                  <Text style={s.primaryBtnText}>Check Status Again</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.secondaryBtn} onPress={signOut}>
              <View style={s.btnContent}>
                <Feather
                  name="log-out"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={s.secondaryBtnText}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ImageBackground>
  )
}

const styles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 32,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 6,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: isDark
        ? 'rgba(239, 68, 68, 0.12)'
        : '#fef2f2',
      borderWidth: 1,
      borderColor: isDark ? '#7f1d1d' : '#fecaca',
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 24,
      width: '100%',
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#fca5a5' : '#b91c1c',
      lineHeight: 19,
    },
    actions: {
      width: '100%',
      gap: 12,
    },
    primaryBtn: {
      width: '100%',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    btnDisabled: {
      opacity: 0.65,
    },
    btnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    primaryBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
    secondaryBtn: {
      width: '100%',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryBtnText: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 15,
    },
  })
