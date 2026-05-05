import React from 'react'
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native'
import { useTheme } from '../lib/ThemeContext'
import { Feather } from '@expo/vector-icons'

export default function AnnouncementDetailScreen({ route, navigation }: any) {
  const { announcement } = route.params
  const { colors, isDark } = useTheme()

  const s = styles(colors, isDark)

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {announcement.image_url && (
          <Image 
            source={{ uri: announcement.image_url }} 
            style={s.image}
            resizeMode="cover"
          />
        )}
        
        <View style={s.content}>
          <View style={s.meta}>
            <View style={s.tag}>
              <Feather name="volume-2" size={12} color="#6366f1" />
              <Text style={s.tagText}>System Update</Text>
            </View>
            <Text style={s.date}>
              {new Date(announcement.created_at).toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </Text>
          </View>

          <Text style={s.title}>{announcement.title}</Text>
          
          <View style={s.divider} />
          
          <Text style={s.text}>{announcement.content}</Text>
          
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
      
      <View style={s.footer}>
        <TouchableOpacity 
          style={s.closeButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={s.closeButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  image: {
    width: '100%',
    height: 240,
    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
  },
  content: {
    padding: 24,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 32,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
    width: '20%',
  },
  text: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.textSecondary,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  closeButton: {
    backgroundColor: isDark ? '#334155' : '#f1f5f9',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  }
})
