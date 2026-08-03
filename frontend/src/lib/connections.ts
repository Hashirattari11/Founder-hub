import { supabase } from './supabase'
import { api } from './api'
import type { ConnectionRow } from '../types'

export type ConnectionState =
  | { status: 'none' }
  | { status: 'requested' }
  | { status: 'pending' }
  | { status: 'accepted' }

/** Determine the connection state between viewer and another user. */
export async function getConnectionState(
  viewerId: string,
  otherId: string,
): Promise<ConnectionState> {
  if (viewerId === otherId) return { status: 'none' }
  const { data, error } = await supabase
    .from('connections')
    .select('requester_id, receiver_id, status')
    .or(`and(requester_id.eq.${viewerId},receiver_id.eq.${otherId}),and(requester_id.eq.${otherId},receiver_id.eq.${viewerId})`)
    .maybeSingle()
  if (error) return { status: 'none' }
  const row = data as ConnectionRow | null
  if (!row) return { status: 'none' }
  if (row.requester_id === viewerId && row.status === 'pending') return { status: 'pending' }
  if (row.receiver_id === viewerId && row.status === 'pending') return { status: 'requested' }
  return { status: 'accepted' }
}

export async function sendConnectionRequest(requesterId: string, receiverId: string): Promise<void> {
  const { error } = await supabase
    .from('connections')
    .insert({ requester_id: requesterId, receiver_id: receiverId, status: 'pending' })
  if (error) throw error
  // Best-effort email notification to the receiver.
  void api
    .post('/api/notify/connection-request', { receiver_id: receiverId }, { auth: true })
    .catch(() => {})
}

export async function acceptConnectionRequest(receiverId: string, requesterId: string): Promise<void> {
  const { error } = await supabase
    .from('connections')
    .update({ status: 'accepted' })
    .eq('requester_id', requesterId)
    .eq('receiver_id', receiverId)
  if (error) throw error
}

/** Decline an incoming connection request (deletes the pending row). */
export async function rejectConnectionRequest(receiverId: string, requesterId: string): Promise<void> {
  const { error } = await supabase
    .from('connections')
    .delete()
    .eq('requester_id', requesterId)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')
  if (error) throw error
}

/** People to suggest: incoming requests first, then profiles with overlapping skills. */
export async function getPeopleToConnect(
  user: { id: string; role: string | null; skills: string[] | null },
  limit = 3,
): Promise<Array<{ id: string; full_name: string; username: string | null; avatar_url: string | null; role: string | null; skills: string[] | null; city: string | null }>> {
  // People who already sent ME a request — always surface them so I can accept/decline.
  const { data: incoming } = await supabase
    .from('connections')
    .select('requester_id, profiles!connections_requester_id_fkey(id, full_name, username, avatar_url, role, skills, city)')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')

  const byId = new Map<string, {
    id: string
    full_name: string
    username: string | null
    avatar_url: string | null
    role: string | null
    skills: string[] | null
    city: string | null
  }>()

  for (const row of (incoming ?? []) as Array<{
    requester_id: string
    profiles: {
      id: string
      full_name: string | null
      username: string | null
      avatar_url: string | null
      role: string | null
      skills: string[] | null
      city: string | null
    }[] | null
  }>) {
    const p = (row.profiles ?? [])[0]
    if (!p || p.id === user.id) continue
    byId.set(p.id, {
      id: p.id,
      full_name: p.full_name ?? 'New Member',
      username: p.username,
      avatar_url: p.avatar_url,
      role: p.role,
      skills: p.skills ?? [],
      city: p.city,
    })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, role, skills, city')
    .neq('id', user.id)
    .limit(30)
  if (error) throw error

  const userSkills = new Set(user.skills ?? [])
  for (const p of (data ?? []) as Array<{
    id: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
    role: string | null
    skills: string[] | null
    city: string | null
  }>) {
    const overlap = (p.skills ?? []).filter((s: string) => userSkills.has(s)).length
    if (overlap <= 0 && p.role !== user.role) continue
    if (byId.has(p.id)) continue
    byId.set(p.id, {
      id: p.id,
      full_name: p.full_name ?? 'New Member',
      username: p.username,
      avatar_url: p.avatar_url,
      role: p.role,
      skills: p.skills ?? [],
      city: p.city,
    })
  }

  return [...byId.values()].slice(0, limit)
}
