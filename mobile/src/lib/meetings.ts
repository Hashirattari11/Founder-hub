import { api } from './api'
import type { AvailabilitySlot, Meeting, MeetingTimeSlot } from '@/types/meetings'

export interface SlotInput {
  day_of_week: number
  start_time: string
  end_time: string
  timezone: string
}

export function getAvailability(userId: string): Promise<{ slots: AvailabilitySlot[] }> {
  return api.get(`/api/availability/${userId}`, { auth: true })
}

export function saveAvailability(slots: SlotInput[]): Promise<{ saved: number; slots: AvailabilitySlot[] }> {
  return api.put('/api/availability', { slots }, { auth: true })
}

export function getTimeSlots(
  userId: string,
  from: string,
  to: string,
): Promise<{ slots: MeetingTimeSlot[]; generated: number }> {
  return api.get(
    `/api/availability/${userId}/time-slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { auth: true },
  )
}

export function bookMeeting(payload: {
  time_slot_id: string
  title: string
  description: string
  duration_minutes?: number
}): Promise<{ meeting: Meeting }> {
  return api.post('/api/meetings/book', payload, { auth: true })
}

export function createMeeting(payload: {
  title: string
  description?: string
  scheduled_at: string
  duration_minutes?: number
  participant_id?: string | null
}): Promise<{ meeting: Meeting }> {
  return api.post('/api/meetings', payload, { auth: true })
}

export function listMeetings(status: 'upcoming' | 'past'): Promise<{ meetings: Meeting[] }> {
  return api.get(`/api/meetings?status=${status}`, { auth: true })
}

export function getMeeting(id: string): Promise<{ meeting: Meeting }> {
  return api.get(`/api/meetings/${id}`, { auth: true })
}

export function updateMeeting(
  id: string,
  payload: {
    status?: string
    title?: string
    description?: string
    scheduled_at?: string
    duration_minutes?: number
    participant_id?: string | null
  },
): Promise<{ meeting: Meeting }> {
  return api.patch(`/api/meetings/${id}`, payload, { auth: true })
}

export function saveMeetingNotes(id: string, notes: string): Promise<{ meeting: Meeting }> {
  return api.post(`/api/meetings/${id}/notes`, { notes }, { auth: true })
}

export function toLocalDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}
