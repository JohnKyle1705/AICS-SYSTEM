import React from 'react'
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Alert, ImageBackground } from 'react-native'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Feather } from '@expo/vector-icons'

export default function AboutScreen() {
  const { t } = useLanguage()
  const { colors, isDark } = useTheme()

  const s = styles(colors, isDark)

  const handleContact = () => {
    Alert.alert(t('about_contactUs'), 'Call us at (032) 123-4567 for assistance or inquiries.')
  }


  return (
    <ImageBackground source={require('../../assets/images/bg_community_service.png')} style={{ flex: 1 }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(248, 250, 252, 0.85)' }]} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.iconWrapper}>
          <Feather name="info" size={32} color={colors.primary} />
        </View>
        <Text style={s.title}>{t('about_title')}</Text>
        <Text style={s.subtitle}>
          {t('about_subtitle')}
        </Text>
      </View>


      {/* Hero Image */}
      <View style={s.heroCard}>
        <Image 
          source={require('../../assets/about_hero.png')} 
          style={s.heroImage} 
          resizeMode="cover"
        />
        <View style={s.heroOverlay}>
          <Text style={s.heroTitle}>{t('about_heroTitle')}</Text>
          <Text style={s.heroSubtitle}>{t('about_heroSubtitle')}</Text>
        </View>
      </View>


      {/* Services */}
      <Text style={s.sectionTitle}>{t('about_coreServices')}</Text>

      
      <View style={s.servicesGrid}>
        <View style={[s.serviceCard, { borderTopColor: '#ef4444' }]}>
          <View style={[s.serviceIcon, { backgroundColor: '#fee2e2' }]}>
            <Feather name="heart" size={24} color="#ef4444" />
          </View>
          <Text style={s.serviceTitle}>{t('about_medicalTitle')}</Text>
          <Text style={s.serviceDesc}>
            {t('about_medicalDesc')}
          </Text>
        </View>


        <View style={[s.serviceCard, { borderTopColor: '#64748b' }]}>
          <View style={[s.serviceIcon, { backgroundColor: '#f1f5f9' }]}>
            <Feather name="shield" size={24} color="#64748b" />
          </View>
          <Text style={s.serviceTitle}>{t('about_burialTitle')}</Text>
          <Text style={s.serviceDesc}>
            {t('about_burialDesc')}
          </Text>
        </View>

      </View>

      {/* Role of Staff */}
      <View style={s.roleCard}>
        <Image 
          source={require('../../assets/about_services.png')} 
          style={s.roleImage} 
          resizeMode="contain"
        />
        <Text style={s.sectionTitle}>{t('about_staffRoleTitle')}</Text>
        <Text style={s.roleText}>
          {t('about_staffRoleDesc')}
        </Text>

        <View style={s.list}>
          {[t('about_needsAssessment'), t('about_docVerification'), t('about_payoutProcessing'), t('about_monitoring')].map((item, i) => (
            <View key={i} style={s.listItem}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={s.listItemText}>{item}</Text>
            </View>
          ))}
        </View>

      </View>

      {/* Contact */}
      <View style={s.contactCard}>
        <Feather name="phone-call" size={32} color={colors.primary} style={{ marginBottom: 12 }} />
        <Text style={s.contactTitle}>{t('about_needHelp')}</Text>
        <Text style={s.contactDesc}>
          {t('about_contactDesc')}
        </Text>
        <TouchableOpacity style={s.contactBtn} onPress={handleContact}>
          <Text style={s.contactBtnText}>{t('about_contactUs')}</Text>
        </TouchableOpacity>
      </View>

      
      <View style={{ height: 40 }} />
      </ScrollView>
    </ImageBackground>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 10 },
  iconWrapper: { width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  
  heroCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 32, height: 220, backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.6)' },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  heroSubtitle: { color: '#e2e8f0', fontSize: 13, lineHeight: 18 },

  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 16 },
  
  servicesGrid: { gap: 16, marginBottom: 32 },
  serviceCard: { backgroundColor: colors.card, padding: 20, borderRadius: 16, borderTopWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  serviceIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  serviceTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
  serviceDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  roleCard: { backgroundColor: colors.card, padding: 20, borderRadius: 20, marginBottom: 32, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  roleImage: { width: '100%', height: 160, marginBottom: 20, borderRadius: 12, backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
  roleText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  list: { gap: 12 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listItemText: { fontSize: 14, color: colors.text, fontWeight: '500' },

  contactCard: { backgroundColor: isDark ? '#1e3a8a40' : '#eff6ff', padding: 24, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: isDark ? '#1e3a8a80' : '#bfdbfe' },
  contactTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
  contactDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  contactBtn: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  contactBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
})
