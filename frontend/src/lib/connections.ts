import { supabase } from './supabase'
import { api } from './api'
import type { ConnectionRow } from '../types'

type ProfileEmbed = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  role: string | null
  skills?: string[] | null
  city?: string | null
}

function unwrapProfile<T extends ProfileEmbed>(p: T | T[] | null | undefined): T | null {
  if (!p) return null
  return Array.isArray(p) ? (p[0] ?? null) : p
}

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
    .or(
      `and(requester_id.eq.${viewerId},receiver_id.eq.${otherId}),and(requester_id.eq.${otherId},receiver_id.eq.${viewerId})`,
    )
    .limit(2)
  if (error) throw error

  const rows = (data ?? []) as ConnectionRow[]
  if (!rows.length) return { status: 'none' }

  if (rows.some((r) => r.status === 'accepted')) return { status: 'accepted' }

  const minePending = rows.find((r) => r.requester_id === viewerId && r.status === 'pending')
  if (minePending) return { status: 'pending' }

  const theirsPending = rows.find((r) => r.receiver_id === viewerId && r.status === 'pending')
  if (theirsPending) return { status: 'requested' }

  return { status: 'none' }
}

export async function sendConnectionRequest(requesterId: string, receiverId: string): Promise<void> {
  if (requesterId === receiverId) {
    throw new Error("You can't connect with yourself.")
  }

  const existing = await getConnectionState(requesterId, receiverId)
  if (existing.status === 'accepted') {
    throw new Error('You are already connected.')
  }
  if (existing.status === 'pending') {
    throw new Error('Connection request already sent.')
  }
  if (existing.status === 'requested') {
    throw new Error('They already sent you a request — accept it instead.')
  }

  const { error } = await supabase
    .from('connections')
    .insert({ requester_id: requesterId, receiver_id: receiverId, status: 'pending' })
  if (error) {
    if (error.code === '23505') {
      throw new Error('Connection request already sent.')
    }
    throw error
  }

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
): Promise<
  Array<{
    id: string
    full_name: string
    username: string | null
    avatar_url: string | null
    role: string | null
    skills: string[] | null
    city: string | null
  }>
> {
  const { data: incoming } = await supabase
    .from('connections')
    .select(
      'requester_id, profiles!connections_requester_id_fkey(id, full_name, username, avatar_url, role, skills, city)',
    )
    .eq('receiver_id', user.id)
    .eq('status', 'pending')

  const byId = new Map<
    string,
    {
      id: string
      full_name: string
      username: string | null
      avatar_url: string | null
      role: string | null
      skills: string[] | null
      city: string | null
    }
  >()

  for (const row of (incoming ?? []) as Array<{
    requester_id: string
    profiles: ProfileEmbed | ProfileEmbed[] | null
  }>) {
    const p = unwrapProfile(row.profiles)
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
    .not('username', 'is', null)
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

/** List accepted connections for the current user. */
export async function getAcceptedConnections(userId: string) {
  const { data, error } = await supabase
    .from('connections')
    .select(
      'requester_id, receiver_id, status, requester:profiles!connections_requester_id_fkey(id, full_name, username, avatar_url, role), receiver:profiles!connections_receiver_id_fkey(id, full_name, username, avatar_url, role)',
    )
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
  if (error) throw error

  return (data ?? [])
    .map((row) => {
      const r = row as {
        requester_id: string
        receiver_id: string
        requester: ProfileEmbed | ProfileEmbed[] | null
        receiver: ProfileEmbed | ProfileEmbed[] | null
      }
      const other =
        r.requester_id === userId ? unwrapProfile(r.receiver) : unwrapProfile(r.requester)
      return other
    })
    .filter(Boolean)
}
