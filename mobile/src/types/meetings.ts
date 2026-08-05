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
  title: string
  description: string | null
  scheduled_at: string | null
  duration_minutes: number | null
  status: MeetingStatus
  meeting_link: string | null
  created_at: string
  updated_at: string
  organizer?: ProfileBrief | null
  participant?: ProfileBrief | null
}

export interface ProfileBrief {
  full_name: string | null
  avatar_url: string | null
  username: string | null
  role: string | null
  city: string | null
  bio: string | null
}
