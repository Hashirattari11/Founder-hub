import { api } from './api'

export interface SeriesPoint {
  date: string
  label: string
  count: number
}

export interface FounderAnalytics {
  profile: {
    views: number
    unique_viewers: number
    views_30d: SeriesPoint[]
  }
  startups: {
    total: number
    views: number
    unique_viewers: number
    views_30d: SeriesPoint[]
  }
  funnel: {
    profile_views: number
    startup_views: number
    applications: number
    shortlisted: number
    accepted: number
    rejected: number
  }
  rates: {
    conversion_rate: number
    response_rate: number
    acceptance_rate: number
  }
  engagement: {
    connections_received: number
    connections_sent: number
    connections_accepted: number
    messages_sent: number
    meetings: number
  }
  by_startup: Array<{
    id: string
    name: string
    views: number
    applications: number
  }>
}

export async function getFounderAnalytics(): Promise<FounderAnalytics> {
  return api.get<FounderAnalytics>('/api/analytics/founder', { auth: true })
}
