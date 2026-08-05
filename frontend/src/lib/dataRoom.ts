import { api } from './api'
import type {
  DataRoom,
  DataRoomAccess,
  DataRoomAccessRequest,
  DataRoomActivityItem,
  DataRoomCategory,
  DataRoomDocument,
  DataRoomResponse,
} from '../types'

export const DATA_ROOM_CATEGORIES: { value: DataRoomCategory; label: string }[] = [
  { value: 'pitch_deck', label: 'Pitch Deck' },
  { value: 'financials', label: 'Financials' },
  { value: 'legal', label: 'Legal Documents' },
  { value: 'cap_table', label: 'Cap Table' },
  { value: 'product', label: 'Product' },
  { value: 'team', label: 'Team' },
  { value: 'market_research', label: 'Market Research' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'other', label: 'Other' },
]

export const ALLOWED_DATA_ROOM_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
]

const MAX_SIZE = 25 * 1024 * 1024

export function isAllowedDataRoomFile(file: File): string | null {
  if (!ALLOWED_DATA_ROOM_MIME.includes(file.type)) {
    return 'Only PDF, DOCX, XLSX, PPTX, PNG and JPG files are supported'
  }
  if (file.size > MAX_SIZE) {
    return 'File must be under 25MB'
  }
  return null
}

export async function createDataRoom(payload: {
  startup_id: string
  name?: string
  description?: string
  require_nda?: boolean
  nda_text?: string
}): Promise<DataRoom> {
  return api.post<DataRoom>('/api/data-room/create', payload, { auth: true })
}

export async function updateDataRoom(
  id: string,
  payload: { name?: string; description?: string | null; require_nda?: boolean; nda_text?: string | null },
): Promise<DataRoom> {
  return api.patch<DataRoom>(`/api/data-room/${id}`, payload, { auth: true })
}

export async function getDataRoom(startupId: string): Promise<DataRoomResponse> {
  return api.get<DataRoomResponse>(`/api/data-room/${startupId}`, { auth: true })
}

export async function uploadDocument(
  dataRoomId: string,
  payload: {
    file: File
    name: string
    category: DataRoomCategory
    description?: string
    is_confidential: boolean
  },
): Promise<DataRoomDocument> {
  const form = new FormData()
  form.append('file', payload.file)
  form.append('name', payload.name)
  form.append('category', payload.category)
  form.append('description', payload.description ?? '')
  form.append('is_confidential', String(payload.is_confidential))
  return api.post<DataRoomDocument>(`/api/data-room/${dataRoomId}/upload`, form, { auth: true })
}

export async function deleteDocument(documentId: string): Promise<void> {
  await api.delete<{ success: boolean }>(`/api/data-room/document/${documentId}`, { auth: true })
}

export async function requestAccess(dataRoomId: string, message?: string): Promise<void> {
  await api.post<{ success: boolean }>(`/api/data-room/${dataRoomId}/request-access`, { message }, { auth: true })
}

export async function respondToRequest(
  requestId: string,
  payload: { status: 'approved' | 'rejected'; access_level?: string; expires_at?: string | null },
): Promise<void> {
  await api.patch<{ success: boolean }>(`/api/data-room/access-request/${requestId}`, payload, { auth: true })
}

export async function grantAccess(
  dataRoomId: string,
  payload: { user_id: string; access_level: string; expires_at?: string | null },
): Promise<void> {
  await api.post<{ success: boolean }>(`/api/data-room/${dataRoomId}/grant-access`, payload, { auth: true })
}

export async function revokeAccess(accessId: string): Promise<void> {
  await api.delete<{ success: boolean }>(`/api/data-room/access/${accessId}`, { auth: true })
}

export async function signNda(dataRoomId: string): Promise<void> {
  await api.post<{ success: boolean }>(`/api/data-room/${dataRoomId}/sign-nda`, {}, { auth: true })
}

export async function getDocumentSignedUrl(dataRoomId: string, documentId: string): Promise<string> {
  const res = await api.get<{ signed_url: string }>(
    `/api/data-room/${dataRoomId}/document/${documentId}/signed-url`,
    { auth: true },
  )
  return res.signed_url
}

export async function logDocumentAction(documentId: string, action: 'viewed' | 'downloaded' | 'shared'): Promise<void> {
  await api.post<{ success: boolean }>(`/api/data-room/document/${documentId}/log`, { action }, { auth: true })
}

export async function getActivity(dataRoomId: string): Promise<DataRoomActivityItem[]> {
  const res = await api.get<{ activity: DataRoomActivityItem[] }>(`/api/data-room/${dataRoomId}/activity`, { auth: true })
  return res.activity
}

export async function getAccessRequests(dataRoomId: string): Promise<DataRoomAccessRequest[]> {
  const res = await api.get<{ requests: DataRoomAccessRequest[] }>(
    `/api/data-room/${dataRoomId}/access-requests`,
    { auth: true },
  )
  return res.requests
}

export async function getAccessList(dataRoomId: string): Promise<
  (DataRoomAccess & { user?: { full_name: string | null; avatar_url: string | null; role: string | null } | null })[]
> {
  const res = await api.get<{
    access: (DataRoomAccess & { user?: { full_name: string | null; avatar_url: string | null; role: string | null } | null })[]
  }>(`/api/data-room/${dataRoomId}/access-list`, { auth: true })
  return res.access
}
