import type { TerminalSession, ContextUsageData, Feature } from '../main/types'

interface GitFileChange {
  status: string
  filePath: string
  type: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
}

declare global {
  interface Window {
    api: {
      createTerminal: (workingDirectory: string, model?: string, provider?: string) => Promise<TerminalSession>
      createTerminalOnBranch: (sourceDir: string, branchName: string, baseBranch?: string, model?: string, provider?: string) => Promise<TerminalSession>
      listTerminals: () => Promise<TerminalSession[]>
      deleteTerminal: (id: string) => Promise<{ wasLastWorktreeSession: boolean; worktreePath?: string; sourceDirectory?: string; branchName?: string }>
      renameTerminal: (id: string, title: string) => Promise<void>
      reconnectTerminal: (id: string) => Promise<boolean>
      forkConversation: (sourceId: string) => Promise<TerminalSession | null>
      writeTerminal: (id: string, data: string) => void
      resizeTerminal: (id: string, cols: number, rows: number) => void
      setWindowTitle: (title: string) => void
      // Features
      createFeature: (name: string, directory: string) => Promise<Feature>
      listFeatures: () => Promise<Feature[]>
      renameFeature: (id: string, name: string) => Promise<void>
      closeFeature: (id: string) => Promise<{ deletedSessionIds: string[] }>
      createFeatureChat: (featureId: string, model?: string, provider?: string) => Promise<TerminalSession>
      createFeatureChatOnBranch: (featureId: string, branchName: string, baseBranch?: string, model?: string, provider?: string) => Promise<TerminalSession>

      gitBranch: (cwd: string) => Promise<string | null>
      listGitBranches: (cwd: string) => Promise<string[]>
      cleanupWorktree: (sourceDir: string, worktreePath: string, deleteBranch: boolean) => Promise<void>
      gitStatus: (cwd: string) => Promise<GitFileChange[]>
      gitDiff: (cwd: string, filePath: string) => Promise<string | null>
      openDiffWindow: (cwd: string, filePath: string) => Promise<void>
      onDiffData: (callback: (data: { filePath: string; oldContent: string; newContent: string; cwd: string }) => void) => () => void
      signalDiffReady: () => void
      getDiffData: () => Promise<{ filePath: string; oldContent: string; newContent: string; cwd: string; allFiles: string[] } | null>
      switchDiffFile: (filePath: string) => Promise<{ filePath: string; oldContent: string; newContent: string; cwd: string; allFiles: string[] } | null>
      getContextUsage: (sessionId: string, workingDirectory: string) => Promise<ContextUsageData | null>
      readDirectory: (dirPath: string) => Promise<Array<{ name: string; path: string; isDirectory: boolean }>>
      readFileContent: (filePath: string, maxBytes?: number) => Promise<{ content: string; isBinary: boolean; truncated: boolean }>
      openFile: (filePath: string) => Promise<string>
      selectDirectory: () => Promise<string | null>
      onTerminalData: (callback: (id: string, data: string) => void) => () => void
      onTerminalExit: (callback: (id: string) => void) => () => void
      onTerminalTitleUpdated: (callback: (id: string, title: string) => void) => () => void
      onSessionIdUpdated: (callback: (id: string, sessionId: string) => void) => () => void
      onNewTerminalShortcut: (callback: () => void) => () => void
      onCloseTerminalShortcut: (callback: () => void) => () => void
      onCommandPaletteShortcut: (callback: () => void) => () => void
      onSwitchChatShortcut: (callback: (index: number) => void) => () => void
      getSessionPlan: (sessionId: string, workingDirectory: string) => Promise<{ name: string; content: string; modifiedAt: number } | null>
      listPlans: () => Promise<{ name: string; title: string; modifiedAt: number }[]>
      readPlan: (name: string) => Promise<string | null>
      voiceStart: () => Promise<boolean>
      voiceStop: () => Promise<void>
      voiceCancel: () => Promise<void>
      onVoicePartial: (callback: (text: string) => void) => () => void
      onVoiceFinal: (callback: (text: string) => void) => () => void
      onVoiceError: (callback: (error: string) => void) => () => void
      onToggleExplorerShortcut: (callback: () => void) => () => void

      // Web Remote
      webRemoteStart: (port?: number) => Promise<{ port: number; token: string; url: string; qrDataUrl: string }>
      webRemoteStop: () => Promise<void>
      webRemoteStatus: () => Promise<{ running: boolean; port: number | null; connectedClients: number }>
    }
    webUtils: {
      getPathForFile: (file: File) => string
    }
  }
}
