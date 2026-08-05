import Constants from 'expo-constants'
import { Platform } from 'react-native'

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8001'

export const APP_SCHEME = 'founderhub'

export const AVATAR_BUCKET = 'avatars'
export const CHAT_IMAGES_BUCKET = 'chat-images'
export const CHAT_FILES_BUCKET = 'chat-files'
export const CHAT_VOICES_BUCKET = 'chat-voices'
export const POST_MEDIA_BUCKET = 'post-media'
export const RESUMES_BUCKET = 'resumes'

export const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient'

export const supportsRemotePush = Platform.OS === 'ios' || (Platform.OS === 'android' && !IS_EXPO_GO)
