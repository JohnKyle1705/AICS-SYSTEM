import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { ActivityIndicator, View, StatusBar } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { DefaultTheme, DarkTheme } from '@react-navigation/native'
import GlobalHeader from '../components/GlobalHeader'

import LoginScreen from '../screens/LoginScreen'
import RegisterScreen from '../screens/RegisterScreen'
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen'
import DashboardScreen from '../screens/DashboardScreen'
import TreasurerDashboardScreen from '../screens/TreasurerDashboardScreen'
import BeneficiariesScreen from '../screens/BeneficiariesScreen'
import BeneficiaryFormScreen from '../screens/BeneficiaryFormScreen'
import RequestsScreen from '../screens/RequestsScreen'
import RequestFormScreen from '../screens/RequestFormScreen'
import RequestDetailScreen from '../screens/RequestDetailScreen'
import AssessmentFormScreen from '../screens/AssessmentFormScreen'
import PayoutFormScreen from '../screens/PayoutFormScreen'
import NotificationsScreen from '../screens/NotificationsScreen'
import UsersScreen from '../screens/UsersScreen'
import ReportsScreen from '../screens/ReportsScreen'
import AuditLogsScreen from '../screens/AuditLogsScreen'
import SettingsScreen from '../screens/SettingsScreen'
import AboutScreen from '../screens/AboutScreen'
import FeedbackReviewScreen from '../screens/FeedbackReviewScreen'
import AnnouncementDetailScreen from '../screens/AnnouncementDetailScreen'
import FundsDashboardScreen from '../screens/FundsDashboardScreen'
import FundTransactionsScreen from '../screens/FundTransactionsScreen'
import AssessmentsScreen from '../screens/AssessmentsScreen'
import PayoutsScreen from '../screens/PayoutsScreen'
import AnnouncementsManageScreen from '../screens/AnnouncementsManageScreen'
import RequirementsScreen from '../screens/RequirementsScreen'
import PendingScreen from '../screens/PendingScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

function TabNavigator() {
  const insets = useSafeAreaInsets()
  const { profile } = useAuth()
  const { colors, isDark } = useTheme()
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDark ? '#94a3b8' : '#94a3b8',
        tabBarIcon: ({ color, size }) => {
          let iconName: any = 'circle'
          if (route.name === 'Dashboard' || route.name === 'TreasurerDashboard') iconName = 'home'
          else if (route.name === 'Beneficiaries') iconName = 'users'
          else if (route.name === 'Requests') iconName = 'file-text'
          else if (route.name === 'Notifications') iconName = 'bell'
          else if (route.name === 'Users') iconName = 'shield'
          return <Feather name={iconName} size={size} color={color} />
        },
        tabBarStyle: {
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          height: 60 + Math.max(insets.bottom, 0),
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: -4 },
      })}
    >
      {profile?.role === 'treasurer' ? (
        <Tab.Screen name="TreasurerDashboard" component={TreasurerDashboardScreen}
          options={{ tabBarLabel: 'Home' }} />
      ) : (
        <Tab.Screen name="Dashboard" component={DashboardScreen}
          options={{ tabBarLabel: 'Home' }} />
      )}
      {(profile?.role === 'admin') && (
        <Tab.Screen name="Beneficiaries" component={BeneficiariesScreen}
          options={{ tabBarLabel: 'Beneficiaries' }} />
      )}
      <Tab.Screen name="Requests" component={RequestsScreen}
        options={{ tabBarLabel: 'Requests' }} />
      {profile?.role === 'admin' && (
        <Tab.Screen name="Users" component={UsersScreen}
          options={{ tabBarLabel: 'Users' }} />
      )}
      <Tab.Screen name="Notifications" component={NotificationsScreen}
        options={{ tabBarLabel: 'Alerts' }} />
    </Tab.Navigator>
  )
}

function MainLayout() {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GlobalHeader />
      <TabNavigator />
    </View>
  )
}

export default function AppNavigator() {
  const { session, profile, loading } = useAuth()
  const { theme, colors, isDark } = useTheme()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  }

  const stackOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.text,
    headerShadowVisible: false,
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.card} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : profile?.is_active === false ? (
          <Stack.Screen name="Pending" component={PendingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainLayout} />
            <Stack.Screen name="BeneficiaryForm" component={BeneficiaryFormScreen}
              options={{ ...stackOptions, title: 'Beneficiary' }} />
            <Stack.Screen name="RequestForm" component={RequestFormScreen}
              options={{ ...stackOptions, title: 'New Request' }} />
            <Stack.Screen name="RequestDetail" component={RequestDetailScreen}
              options={{ ...stackOptions, title: 'Request Details' }} />
            <Stack.Screen name="AnnouncementDetail" component={AnnouncementDetailScreen}
              options={{ ...stackOptions, title: 'Announcement' }} />
            <Stack.Screen name="AssessmentForm" component={AssessmentFormScreen}
              options={{ ...stackOptions, title: 'Assessment' }} />
            <Stack.Screen name="Assessments" component={AssessmentsScreen}
              options={{ ...stackOptions, title: 'Assessments' }} />
            <Stack.Screen name="PayoutForm" component={PayoutFormScreen}
              options={{ ...stackOptions, title: 'Record Payout' }} />
            <Stack.Screen name="Payouts" component={PayoutsScreen}
              options={{ ...stackOptions, title: 'Payout Records' }} />
            <Stack.Screen name="AnnouncementsManage" component={AnnouncementsManageScreen}
              options={{ ...stackOptions, title: 'Announcements' }} />
            <Stack.Screen name="Requirements" component={RequirementsScreen}
              options={{ ...stackOptions, title: 'Requirements Setup' }} />
            <Stack.Screen name="Reports" component={ReportsScreen}
              options={{ ...stackOptions, title: 'System Reports' }} />
            <Stack.Screen name="FundsDashboard" component={FundsDashboardScreen}
              options={{ ...stackOptions, title: 'Fund Tracking' }} />
            <Stack.Screen name="FundTransactions" component={FundTransactionsScreen}
              options={{ ...stackOptions, title: 'Fund Ledger' }} />
            <Stack.Screen name="AuditLogs" component={AuditLogsScreen}
              options={{ ...stackOptions, title: 'Audit Logs' }} />
            <Stack.Screen name="Settings" component={SettingsScreen}
              options={{ ...stackOptions, title: 'Settings' }} />
            <Stack.Screen name="FeedbackReview" component={FeedbackReviewScreen}
              options={{ ...stackOptions, title: 'System Feedback' }} />
            <Stack.Screen name="About" component={AboutScreen}
              options={{ ...stackOptions, title: 'About AICS' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
