import React, { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { configureNotifications, registerPushToken } from '@/lib/push'
import { BiometricGate } from '@/components/BiometricGate'
import { colors } from '@/theme'

configureNotifications()

function useNotificationObserver() {
  useEffect(() => {
    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url
      if (typeof url === 'string' && url.startsWith('/')) {
        router.push(url as never)
      }
    }

    const response = Notifications.getLastNotificationResponse()
    if (response?.notification) redirect(response.notification)

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification)
    })

    return () => subscription.remove()
  }, [])
}

function RootNavigator() {
  const { session, loading } = useAuth()

  useEffect(() => {
    if (session?.user.id) {
      registerPushToken()
    }
  }, [session?.user.id])

  useNotificationObserver()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!session ? (
        <Stack.Screen name="(auth)" />
      ) : (
        <>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[chatId]" />
          <Stack.Screen name="user/[userId]" />
          <Stack.Screen name="startup/[id]" />
          <Stack.Screen name="equity/[id]" />
          <Stack.Screen name="business-plan" />
          <Stack.Screen name="business-plan/new" />
          <Stack.Screen name="business-plan/[id]" />
          <Stack.Screen name="job/[id]" />
          <Stack.Screen name="ai-studio/index" />
          <Stack.Screen name="ai-studio/[slug]" />
          <Stack.Screen name="post/[postId]" />
          <Stack.Screen name="jobs" />
          <Stack.Screen name="startups" />
          <Stack.Screen name="investors" />
          <Stack.Screen name="community" />
          <Stack.Screen name="network" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="create-post" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="settings" />
        </>
      )}
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationsProvider>
          <BiometricGate>
            <StatusBar style="dark" />
            <RootNavigator />
          </BiometricGate>
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
