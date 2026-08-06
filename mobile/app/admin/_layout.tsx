import React from 'react'
import { Stack, router } from 'expo-router'
import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useAuth } from '@/context/AuthContext'
import { isAdminProfile } from '@/lib/admin'
import { colors } from '@/theme'

export default function AdminLayout() {
  const { session, profile, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!session || !isAdminProfile(profile)) {
      router.replace('/')
    }
  }, [session, profile, loading])

  if (loading || !session || !isAdminProfile(profile)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="startups" />
      <Stack.Screen name="role-requests" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="startup-members" />
    </Stack>
  )
}
