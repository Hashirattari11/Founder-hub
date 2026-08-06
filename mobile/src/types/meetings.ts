export interface AvailabilitySlot {
  id: string
  user_id: string
  day_of_week: number
  start_time: string
  end_time: string
  timezone: string
  is_active: boolean
}

export interface MeetingTimeSlot {
  id: string
  availability_slot_id: string
  starts_at: string
  ends_at: string
  is_booked: boolean
  meeting_id: string | null
  meetings?: { id: string; title: string; status: string; organizer_id: string } | null
}

export type MeetingStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'

export interface Meeting {
  id: string
  organizer_id: string
  participant_id: string | null
  startup_id: string | null
  created_by: string | null
  title: string
  description: string | null
  scheduled_at: string | null
  duration_minutes: number | null
  status: MeetingStatus
  meeting_link: string | null
  meet_link?: string | null
  started_at: string | null
  ended_at: string | null
  transcript: string | null
  recording_url: string | null
  ai_summary: Record<string, unknown> | null
  created_at: string
  updated_at: string
  organizer?: ProfileBrief | null
  participant?: ProfileBrief | null
  participants?: MeetingParticipant[] | null
  action_items?: MeetingActionItem[] | null
}

export interface MeetingParticipant {
  id: string
  meeting_id: string
  user_id: string
  role: string
  joined_at: string | null
  created_at: string
  profiles?: ProfileBrief | null
}

export type ActionItemStatus = 'pending' | 'in_progress' | 'completed'

export interface MeetingActionItem {
  id: string
  meeting_id: string
  description: string
  assignee_id: string | null
  due_date: string | null
  status: ActionItemStatus
  created_by: string | null
  created_at: string
  updated_at: string
  assignee?: ProfileBrief | null
}

export interface MeetingSummaryResult {
  meeting: Meeting
  summary: string
  action_items: MeetingActionItem[]
  participants: MeetingParticipant[]
}

export interface ProfileBrief {
  full_name: string | null
  avatar_url: string | null
  username: string | null
  role: string | null
  city: string | null
  bio: string | null
}
