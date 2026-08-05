import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { api } from './api'
import { supportsRemotePush } from './config'

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })
}

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    })
  }
}

export async function requestPermissions(): Promise<boolean> {
  await ensureChannel()
  const { status } = await Notifications.getPermissionsAsync()
  let final = status
  if (final !== 'granted') {
    const res = await Notifications.requestPermissionsAsync()
    final = res.status
  }
  return final === 'granted' || (final as string) === 'provisional'
}

export async function registerPushToken(): Promise<boolean> {
  try {
    if (!supportsRemotePush) return false
    const granted = await requestPermissions()
    if (!granted) return false

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId

    let token: string
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    } catch {
      return false
    }

    await api.post(
      '/api/push/token',
      {
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      },
      { auth: true },
    )
    return true
  } catch {
    return false
  }
}

export function scheduleLocalNotification(title: string, body: string, data?: Record<string, unknown>, seconds = 2) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  })
}
