import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Image, ImageBackground, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'

export default function GlobalHeader() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { profile } = useAuth()
  const { isDark } = useTheme()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  return (
    <View style={[styles.headerContainer, { height: 128 + insets.top }]}>
      <ImageBackground 
        source={require('../../assets/images/bg_community_service.png')} 
        style={styles.headerBgImage}
        imageStyle={{ opacity: isDark ? 0.3 : 0.8 }}
      >
        <View style={[styles.headerOverlay, { backgroundColor: isDark ? 'rgba(2, 6, 23, 0.9)' : 'rgba(37, 99, 235, 0.9)' }]} />
        
        <View style={[styles.headerTopRow, { paddingTop: insets.top + 12 }]}>
          <View style={styles.branding}>
            <View style={styles.logoBox}>
              <Image source={require('../../assets/aics_logo.png')} style={styles.logo} />
            </View>
            <View>
              <Text style={styles.brandTitle}>AICS System</Text>
              <Text style={styles.brandSubtitle}>Daanbantayan MSWD</Text>
            </View>
          </View>
          
          <View style={styles.rightActions}>
            <View style={styles.userContainer}>
              <Text style={styles.greetingText}>Hello, {profile?.full_name?.split(' ')[0] || 'User'}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn} activeOpacity={0.7}>
              <Feather name="settings" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Date & Time Row */}
        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeChip}>
            <Feather name="calendar" size={11} color="rgba(255,255,255,0.75)" />
            <Text style={styles.dateTimeText}>{dateStr}</Text>
          </View>
          <View style={styles.dateTimeDivider} />
          <View style={styles.dateTimeChip}>
            <Feather name="clock" size={11} color="rgba(255,255,255,0.75)" />
            <Text style={[styles.dateTimeText, styles.timeText]}>{timeStr}</Text>
          </View>
        </View>
      </ImageBackground>
    </View>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 10,
  },
  headerBgImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-start',
  },
  headerOverlay: {
    ...(StyleSheet.absoluteFill as object),
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  greetingText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Date & Time
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dateTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateTimeDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dateTimeText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  timeText: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
})
