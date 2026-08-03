import { create } from 'zustand'
import { mockNotifications } from '../data/mock'

interface Notification {
  id: string
  type: 'message' | 'application' | 'milestone'
  text: string
  time: string
  read: boolean
}

interface DashboardState {
  sidebarOpen: boolean
  notifications: Notification[]
  unreadCount: number
  toggleSidebar: () => void
  closeSidebar: () => void
  markAllRead: () => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  sidebarOpen: false,
  notifications: mockNotifications,
  unreadCount: mockNotifications.filter((n) => !n.read).length,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
}))
