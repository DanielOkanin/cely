import { create } from 'zustand'
import type { TerminalSession } from './api'

interface RemoteState {
  sessions: TerminalSession[]
  activeSessionId: string | null
  connected: boolean
  drawerOpen: boolean
  showPlans: boolean

  setSessions: (sessions: TerminalSession[]) => void
  setActiveSession: (id: string | null) => void
  addSession: (session: TerminalSession) => void
  removeSession: (id: string) => void
  updateTitle: (id: string, title: string) => void
  setConnected: (connected: boolean) => void
  setDrawerOpen: (open: boolean) => void
  setShowPlans: (show: boolean) => void
}

export const useRemoteStore = create<RemoteState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  connected: false,
  drawerOpen: false,
  showPlans: false,

  setSessions: (sessions) => set({ sessions }),

  setActiveSession: (id) => set({ activeSessionId: id, drawerOpen: false }),

  addSession: (session) => set((s) => ({
    sessions: [session, ...s.sessions],
    activeSessionId: session.id
  })),

  removeSession: (id) => set((s) => {
    const sessions = s.sessions.filter((t) => t.id !== id)
    const activeSessionId = s.activeSessionId === id
      ? (sessions.length > 0 ? sessions[0].id : null)
      : s.activeSessionId
    return { sessions, activeSessionId }
  }),

  updateTitle: (id, title) => set((s) => ({
    sessions: s.sessions.map((t) => t.id === id ? { ...t, title } : t)
  })),

  setConnected: (connected) => set({ connected }),

  setDrawerOpen: (open) => set({ drawerOpen: open }),

  setShowPlans: (show) => set({ showPlans: show })
}))
