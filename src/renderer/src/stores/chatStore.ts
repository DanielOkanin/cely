import { create } from 'zustand'
import { PROVIDERS, getProviderById, inferProvider } from '../../../shared/providers'
import type { AgentProviderId } from '../../../shared/providers'

export { PROVIDERS, getProviderById, inferProvider }
export type { AgentProviderId }

export const DEFAULT_MODEL = PROVIDERS[0].defaultModel

interface Feature {
  id: string
  name: string
  directory: string
  createdAt: number
  updatedAt: number
}

interface TerminalSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  workingDirectory: string
  model: string
  sessionId: string
  provider: AgentProviderId
  worktreePath?: string | null
  sourceDirectory?: string | null
  featureId?: string | null
}

interface TerminalState {
  terminals: TerminalSession[]
  activeTerminalId: string | null
  connectedTerminals: Set<string>
  unreadTerminals: Set<string>
  typingTerminals: Set<string>
  recentlyReconnected: Set<string>
  selectedProvider: AgentProviderId
  selectedModel: string
  searchQuery: string
  sidebarWidth: number
  filesPanelWidth: number
  showCommandPalette: boolean
  showPlanView: boolean
  activeSidebarView: 'chats' | 'files' | 'remote'
  expandedDirs: Set<string>
  previewFilePath: string | null
  forkingId: string | null
  pendingWorktreeCleanup: { worktreePath: string; sourceDirectory: string; branchName?: string } | null
  showBranchCreation: boolean
  branchCreationDir: string | null
  showProjectPicker: boolean
  features: Feature[]
  expandedFeatures: Set<string>
  showFeatureCreation: boolean
  featureBranchCreation: { featureId: string; directory: string } | null
  confirmCloseFeatureId: string | null

  loadTerminals: () => Promise<void>
  loadFeatures: () => Promise<void>
  setActiveTerminal: (id: string) => void
  createTerminal: () => Promise<void>
  createTerminalInDir: (dir: string) => Promise<void>
  createTerminalOnBranch: (sourceDir: string, branchName: string, baseBranch?: string) => Promise<void>
  forkConversation: (sourceId: string) => Promise<void>
  deleteTerminal: (id: string) => Promise<void>
  confirmWorktreeCleanup: (deleteBranch: boolean) => Promise<void>
  setShowProjectPicker: (show: boolean) => void
  createTerminalInDirQuick: (dir: string) => Promise<void>
  setShowBranchCreation: (show: boolean, dir?: string | null) => void
  createFeature: (name: string, directory: string) => Promise<void>
  renameFeature: (id: string, name: string) => Promise<void>
  closeFeature: (id: string) => Promise<void>
  createFeatureChat: (featureId: string) => Promise<void>
  createFeatureChatOnBranch: (featureId: string, branchName: string, baseBranch?: string) => Promise<void>
  toggleFeatureExpanded: (featureId: string) => void
  setShowFeatureCreation: (show: boolean) => void
  quickCreateFeature: () => Promise<void>
  setFeatureBranchCreation: (data: { featureId: string; directory: string } | null) => void
  setConfirmCloseFeatureId: (id: string | null) => void
  renameTerminal: (id: string, title: string) => Promise<void>
  markConnected: (id: string) => void
  markDisconnected: (id: string) => void
  markUnread: (id: string) => void
  clearUnread: (id: string) => void
  markTyping: (id: string) => void
  clearTyping: (id: string) => void
  updateTitle: (id: string, title: string) => void
  updateSessionId: (id: string, sessionId: string) => void
  setSelectedProvider: (provider: AgentProviderId) => void
  setSelectedModel: (model: string) => void
  updateModel: (id: string, model: string) => void
  setSearchQuery: (query: string) => void
  setSidebarWidth: (width: number) => void
  setFilesPanelWidth: (width: number) => void
  setShowCommandPalette: (show: boolean) => void
  setShowPlanView: (show: boolean) => void
  setActiveSidebarView: (view: 'chats' | 'files' | 'remote') => void
  toggleDirExpanded: (dirPath: string) => void
  setPreviewFile: (path: string | null) => void
  switchToIndex: (index: number) => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  activeTerminalId: null,
  connectedTerminals: new Set(),
  unreadTerminals: new Set(),
  typingTerminals: new Set(),
  recentlyReconnected: new Set(),
  selectedProvider: 'claude' as AgentProviderId,
  selectedModel: DEFAULT_MODEL,
  searchQuery: '',
  sidebarWidth: 256,
  filesPanelWidth: 288,
  showCommandPalette: false,
  showPlanView: false,
  activeSidebarView: 'chats',
  expandedDirs: new Set(),
  previewFilePath: null,
  forkingId: null,
  pendingWorktreeCleanup: null,
  showBranchCreation: false,
  branchCreationDir: null,
  showProjectPicker: false,
  features: [],
  expandedFeatures: new Set(),
  showFeatureCreation: false,
  featureBranchCreation: null,
  confirmCloseFeatureId: null,

  loadFeatures: async () => {
    const features = await window.api.listFeatures()
    set({ features })
  },

  loadTerminals: async () => {
    const terminals = await window.api.listTerminals()
    terminals.sort((a: TerminalSession, b: TerminalSession) => b.updatedAt - a.updatedAt)
    set({ terminals })
  },

  setActiveTerminal: (id: string) => {
    const state = get()
    const unread = new Set(state.unreadTerminals)
    unread.delete(id)
    const typing = new Set(state.typingTerminals)
    typing.delete(id)
    set({ activeTerminalId: id, unreadTerminals: unread, typingTerminals: typing })
    // Update window title
    const terminal = state.terminals.find((t) => t.id === id)
    if (terminal) {
      window.api.setWindowTitle(terminal.title)
    }
    // Auto-reconnect if not connected
    if (!state.connectedTerminals.has(id)) {
      // Suppress notifications during startup output
      const rc = new Set(get().recentlyReconnected)
      rc.add(id)
      set({ recentlyReconnected: rc })
      setTimeout(() => {
        const rc2 = new Set(get().recentlyReconnected)
        rc2.delete(id)
        set({ recentlyReconnected: rc2 })
      }, 5000)

      window.api.reconnectTerminal(id).then((ok: boolean) => {
        if (ok) {
          const connected = new Set(get().connectedTerminals)
          connected.add(id)
          set({ connectedTerminals: connected })
        }
      })
    }
  },

  createTerminal: async () => {
    // If there's an active terminal, reuse its directory (one-click!)
    const { activeTerminalId, terminals, selectedModel, selectedProvider } = get()
    const active = terminals.find((t) => t.id === activeTerminalId)
    if (active) {
      const dir = active.sourceDirectory || active.workingDirectory
      const terminal = await window.api.createTerminal(dir, selectedModel, selectedProvider)
      set((state) => ({
        terminals: [terminal, ...state.terminals],
        activeTerminalId: terminal.id,
        connectedTerminals: new Set([...state.connectedTerminals, terminal.id])
      }))
      window.api.setWindowTitle(terminal.title)
      return
    }
    // No active terminal — show project picker
    set({ showProjectPicker: true })
  },

  setShowProjectPicker: (show: boolean) => {
    set({ showProjectPicker: show })
  },

  createTerminalInDirQuick: async (dir: string) => {
    const { selectedModel, selectedProvider } = get()
    const terminal = await window.api.createTerminal(dir, selectedModel, selectedProvider)
    set((state) => ({
      terminals: [terminal, ...state.terminals],
      activeTerminalId: terminal.id,
      connectedTerminals: new Set([...state.connectedTerminals, terminal.id]),
      showProjectPicker: false
    }))
    window.api.setWindowTitle(terminal.title)
  },

  createTerminalInDir: async (dir: string) => {
    const { selectedModel, selectedProvider } = get()
    const terminal = await window.api.createTerminal(dir, selectedModel, selectedProvider)
    set((state) => ({
      terminals: [terminal, ...state.terminals],
      activeTerminalId: terminal.id,
      connectedTerminals: new Set([...state.connectedTerminals, terminal.id])
    }))
    window.api.setWindowTitle(terminal.title)
  },

  createTerminalOnBranch: async (sourceDir: string, branchName: string, baseBranch?: string) => {
    const { selectedModel, selectedProvider } = get()
    const terminal = await window.api.createTerminalOnBranch(sourceDir, branchName, baseBranch, selectedModel, selectedProvider)
    set((state) => ({
      terminals: [terminal, ...state.terminals],
      activeTerminalId: terminal.id,
      connectedTerminals: new Set([...state.connectedTerminals, terminal.id]),
      showBranchCreation: false,
      branchCreationDir: null
    }))
    window.api.setWindowTitle(terminal.title)
  },

  forkConversation: async (sourceId: string) => {
    set({ forkingId: sourceId })
    try {
      const terminal = await window.api.forkConversation(sourceId)
      if (!terminal) return
      set((state) => ({
        terminals: [terminal, ...state.terminals],
        activeTerminalId: terminal.id,
        connectedTerminals: new Set([...state.connectedTerminals, terminal.id])
      }))
      window.api.setWindowTitle(terminal.title)
    } finally {
      set({ forkingId: null })
    }
  },

  deleteTerminal: async (id: string) => {
    const result = await window.api.deleteTerminal(id)
    set((state) => {
      const terminals = state.terminals.filter((t) => t.id !== id)
      const connected = new Set(state.connectedTerminals)
      connected.delete(id)
      const unread = new Set(state.unreadTerminals)
      unread.delete(id)
      const typing = new Set(state.typingTerminals)
      typing.delete(id)
      const newActiveId =
        state.activeTerminalId === id
          ? terminals.length > 0
            ? terminals[0].id
            : null
          : state.activeTerminalId
      const pendingWorktreeCleanup = result.wasLastWorktreeSession
        ? { worktreePath: result.worktreePath!, sourceDirectory: result.sourceDirectory!, branchName: result.branchName }
        : null
      return { terminals, activeTerminalId: newActiveId, connectedTerminals: connected, unreadTerminals: unread, typingTerminals: typing, pendingWorktreeCleanup }
    })
  },

  renameTerminal: async (id: string, title: string) => {
    await window.api.renameTerminal(id, title)
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, title } : t))
    }))
  },

  confirmWorktreeCleanup: async (deleteBranch: boolean) => {
    const cleanup = get().pendingWorktreeCleanup
    if (cleanup) {
      await window.api.cleanupWorktree(cleanup.sourceDirectory, cleanup.worktreePath, deleteBranch)
    }
    set({ pendingWorktreeCleanup: null })
  },

  setShowBranchCreation: (show: boolean, dir?: string | null) => {
    set({ showBranchCreation: show, branchCreationDir: dir ?? null })
  },

  createFeature: async (name: string, directory: string) => {
    const feature = await window.api.createFeature(name, directory)
    set((state) => ({
      features: [feature, ...state.features],
      showFeatureCreation: false,
      expandedFeatures: new Set([...state.expandedFeatures, feature.id])
    }))
  },

  renameFeature: async (id: string, name: string) => {
    await window.api.renameFeature(id, name)
    set((state) => ({
      features: state.features.map((f) => (f.id === id ? { ...f, name } : f))
    }))
  },

  closeFeature: async (id: string) => {
    const result = await window.api.closeFeature(id)
    set((state) => {
      const deletedSet = new Set(result.deletedSessionIds)
      const terminals = state.terminals.filter((t) => !deletedSet.has(t.id))
      const connected = new Set(state.connectedTerminals)
      const unread = new Set(state.unreadTerminals)
      const typing = new Set(state.typingTerminals)
      for (const sid of result.deletedSessionIds) {
        connected.delete(sid)
        unread.delete(sid)
        typing.delete(sid)
      }
      const newActiveId = deletedSet.has(state.activeTerminalId || '')
        ? (terminals.length > 0 ? terminals[0].id : null)
        : state.activeTerminalId
      return {
        features: state.features.filter((f) => f.id !== id),
        terminals,
        activeTerminalId: newActiveId,
        connectedTerminals: connected,
        unreadTerminals: unread,
        typingTerminals: typing,
        confirmCloseFeatureId: null
      }
    })
  },

  createFeatureChat: async (featureId: string) => {
    const { selectedModel, selectedProvider } = get()
    const terminal = await window.api.createFeatureChat(featureId, selectedModel, selectedProvider)
    if (!terminal) return
    set((state) => ({
      terminals: [terminal, ...state.terminals],
      activeTerminalId: terminal.id,
      connectedTerminals: new Set([...state.connectedTerminals, terminal.id])
    }))
    window.api.setWindowTitle(terminal.title)
  },

  createFeatureChatOnBranch: async (featureId: string, branchName: string, baseBranch?: string) => {
    const { selectedModel, selectedProvider } = get()
    const terminal = await window.api.createFeatureChatOnBranch(featureId, branchName, baseBranch, selectedModel, selectedProvider)
    if (!terminal) return
    set((state) => ({
      terminals: [terminal, ...state.terminals],
      activeTerminalId: terminal.id,
      connectedTerminals: new Set([...state.connectedTerminals, terminal.id]),
      featureBranchCreation: null
    }))
    window.api.setWindowTitle(terminal.title)
  },

  toggleFeatureExpanded: (featureId: string) => {
    set((state) => {
      const expanded = new Set(state.expandedFeatures)
      if (expanded.has(featureId)) expanded.delete(featureId)
      else expanded.add(featureId)
      return { expandedFeatures: expanded }
    })
  },

  setShowFeatureCreation: (show: boolean) => {
    set({ showFeatureCreation: show })
  },

  quickCreateFeature: async () => {
    // If there's an active terminal, create a feature in the same repo (one-click!)
    const { activeTerminalId, terminals } = get()
    const active = terminals.find((t) => t.id === activeTerminalId)
    if (active) {
      const dir = active.sourceDirectory || active.workingDirectory
      const name = dir.split('/').pop() || 'feature'
      const feature = await window.api.createFeature(`New Feature — ${name}`, dir)
      set((state) => ({
        features: [feature, ...state.features],
        expandedFeatures: new Set([...state.expandedFeatures, feature.id])
      }))
      return
    }
    // No active terminal — show the creation form
    set({ showFeatureCreation: true })
  },

  setFeatureBranchCreation: (data: { featureId: string; directory: string } | null) => {
    set({ featureBranchCreation: data })
  },

  setConfirmCloseFeatureId: (id: string | null) => {
    set({ confirmCloseFeatureId: id })
  },

  markConnected: (id: string) => {
    set((state) => {
      const connected = new Set(state.connectedTerminals)
      connected.add(id)
      return { connectedTerminals: connected }
    })
  },

  markDisconnected: (id: string) => {
    set((state) => {
      const connected = new Set(state.connectedTerminals)
      connected.delete(id)
      const typing = new Set(state.typingTerminals)
      typing.delete(id)
      return { connectedTerminals: connected, typingTerminals: typing }
    })
  },

  markUnread: (id: string) => {
    const state = get()
    if (state.activeTerminalId === id) return
    set((s) => {
      const unread = new Set(s.unreadTerminals)
      unread.add(id)
      return { unreadTerminals: unread }
    })
  },

  clearUnread: (id: string) => {
    set((state) => {
      const unread = new Set(state.unreadTerminals)
      unread.delete(id)
      return { unreadTerminals: unread }
    })
  },

  markTyping: (id: string) => {
    set((state) => {
      if (state.typingTerminals.has(id)) return state
      const typing = new Set(state.typingTerminals)
      typing.add(id)
      return { typingTerminals: typing }
    })
  },

  clearTyping: (id: string) => {
    set((state) => {
      if (!state.typingTerminals.has(id)) return state
      const typing = new Set(state.typingTerminals)
      typing.delete(id)
      return { typingTerminals: typing }
    })
  },

  updateTitle: (id: string, title: string) => {
    set((state) => {
      const updated = state.terminals.map((t) => (t.id === id ? { ...t, title } : t))
      if (state.activeTerminalId === id) {
        window.api.setWindowTitle(title)
      }
      return { terminals: updated }
    })
  },

  updateSessionId: (id: string, sessionId: string) => {
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, sessionId } : t))
    }))
  },

  setSelectedProvider: (provider: AgentProviderId) => {
    const providerConfig = getProviderById(provider)
    set({ selectedProvider: provider, selectedModel: providerConfig.defaultModel })
  },

  setSelectedModel: (model: string) => {
    set({ selectedModel: model })
  },

  updateModel: (id: string, model: string) => {
    set((state) => ({
      terminals: state.terminals.map((t) => (t.id === id ? { ...t, model } : t))
    }))
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  setSidebarWidth: (width: number) => {
    set({ sidebarWidth: Math.max(200, Math.min(480, width)) })
  },

  setFilesPanelWidth: (width: number) => {
    set({ filesPanelWidth: Math.max(200, Math.min(500, width)) })
  },

  setShowCommandPalette: (show: boolean) => {
    set({ showCommandPalette: show })
  },

  setShowPlanView: (show: boolean) => {
    set({ showPlanView: show })
  },

  setActiveSidebarView: (view: 'chats' | 'files' | 'remote') => {
    set({ activeSidebarView: view })
  },

  setPreviewFile: (path: string | null) => {
    set({ previewFilePath: path })
  },

  toggleDirExpanded: (dirPath: string) => {
    set((state) => {
      const expanded = new Set(state.expandedDirs)
      if (expanded.has(dirPath)) expanded.delete(dirPath)
      else expanded.add(dirPath)
      return { expandedDirs: expanded }
    })
  },

  switchToIndex: (index: number) => {
    const { terminals } = get()
    if (index >= 0 && index < terminals.length) {
      const id = terminals[index].id
      get().setActiveTerminal(id)
    }
  }
}))
