import type { AgentProviderId } from './providers/types'

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'

export interface StreamingEvent {
  type: 'text_delta' | 'tool_use_start' | 'tool_use_end' | 'complete' | 'error'
  chatId: string
  content?: string
  toolName?: string
  toolInput?: string
  sessionId?: string
  error?: string
}

export interface Feature {
  id: string
  name: string
  directory: string
  createdAt: number
  updatedAt: number
}

export interface TerminalSession {
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

export const DEFAULT_PROVIDER: AgentProviderId = 'claude'
export const DEFAULT_MODEL = 'claude-opus-4-6'

export interface ContextUsageData {
  contextUsed: number
  outputTokens: number
  model?: string | null
}

export interface ElectronAPI {
  createTerminal: (workingDirectory: string, model?: string, provider?: string) => Promise<TerminalSession>
  createTerminalOnBranch: (sourceDir: string, branchName: string, baseBranch?: string, model?: string, provider?: string) => Promise<TerminalSession>
  listTerminals: () => Promise<TerminalSession[]>
  deleteTerminal: (id: string) => Promise<{ wasLastWorktreeSession: boolean; worktreePath?: string; sourceDirectory?: string; branchName?: string }>
  listGitBranches: (cwd: string) => Promise<string[]>
  cleanupWorktree: (sourceDir: string, worktreePath: string, deleteBranch: boolean) => Promise<void>
  renameTerminal: (id: string, title: string) => Promise<void>
  reconnectTerminal: (id: string) => Promise<void>
  writeTerminal: (id: string, data: string) => void
  resizeTerminal: (id: string, cols: number, rows: number) => void
  setWindowTitle: (title: string) => void
  gitBranch: (cwd: string) => Promise<string>
  gitStatus: (cwd: string) => Promise<{ file: string; status: string }[]>
  gitDiff: (cwd: string, filePath: string) => Promise<string>
  openDiffWindow: (cwd: string, filePath: string) => Promise<void>
  onDiffData: (callback: (data: { filePath: string; oldContent: string; newContent: string; cwd: string }) => void) => () => void
  signalDiffReady: () => void
  getDiffData: () => Promise<{ filePath: string; oldContent: string; newContent: string; cwd: string }>
  switchDiffFile: (filePath: string) => Promise<void>
  getContextUsage: (sessionId: string, workingDirectory: string) => Promise<ContextUsageData | null>
  // Projects
  pinProject: (directory: string, name?: string) => Promise<{ id: string; directory: string; name: string; createdAt: number }>
  unpinProject: (id: string) => Promise<void>
  unpinProjectByDir: (directory: string) => Promise<void>
  listPinnedProjects: () => Promise<{ id: string; directory: string; name: string; createdAt: number }[]>
  listRecentProjects: (limit?: number) => Promise<string[]>
  isProjectPinned: (directory: string) => Promise<boolean>
  selectDirectory: () => Promise<string | null>
  onTerminalData: (callback: (id: string, data: string) => void) => () => void
  onTerminalExit: (callback: (id: string) => void) => () => void
  onTerminalTitleUpdated: (callback: (id: string, title: string) => void) => () => void
  onSessionIdUpdated: (callback: (id: string, sessionId: string) => void) => () => void
  onNewTerminalShortcut: (callback: () => void) => () => void
  onCloseTerminalShortcut: (callback: () => void) => () => void
  onCommandPaletteShortcut: (callback: () => void) => () => void
  onSwitchChatShortcut: (callback: (index: number) => void) => () => void

  // Web Remote
  webRemoteStart: (port?: number) => Promise<{ port: number; token: string; url: string; qrDataUrl: string }>
  webRemoteStop: () => Promise<void>
  webRemoteStatus: () => Promise<{ running: boolean; port: number | null; connectedClients: number }>
}
