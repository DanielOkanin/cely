import { contextBridge, ipcRenderer, webUtils } from 'electron'

const api = {
  createTerminal: (workingDirectory: string, model?: string, provider?: string) =>
    ipcRenderer.invoke('terminal:create', workingDirectory, model, provider),
  createTerminalOnBranch: (sourceDir: string, branchName: string, baseBranch?: string, model?: string, provider?: string) =>
    ipcRenderer.invoke('terminal:create-on-branch', sourceDir, branchName, baseBranch, model, provider),
  listTerminals: () => ipcRenderer.invoke('terminal:list'),
  deleteTerminal: (id: string) => ipcRenderer.invoke('terminal:delete', id),
  renameTerminal: (id: string, title: string) =>
    ipcRenderer.invoke('terminal:rename', id, title),
  reconnectTerminal: (id: string) => ipcRenderer.invoke('terminal:reconnect', id),
  forkConversation: (sourceId: string) => ipcRenderer.invoke('terminal:fork', sourceId),
  writeTerminal: (id: string, data: string) =>
    ipcRenderer.send('terminal:write', id, data),
  resizeTerminal: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', id, cols, rows),
  setWindowTitle: (title: string) =>
    ipcRenderer.send('window:set-title', title),
  // Features
  createFeature: (name: string, directory: string) => ipcRenderer.invoke('feature:create', name, directory),
  listFeatures: () => ipcRenderer.invoke('feature:list'),
  renameFeature: (id: string, name: string) => ipcRenderer.invoke('feature:rename', id, name),
  closeFeature: (id: string) => ipcRenderer.invoke('feature:close', id),
  createFeatureChat: (featureId: string, model?: string, provider?: string) =>
    ipcRenderer.invoke('feature:create-chat', featureId, model, provider),
  createFeatureChatOnBranch: (featureId: string, branchName: string, baseBranch?: string, model?: string, provider?: string) =>
    ipcRenderer.invoke('feature:create-chat-on-branch', featureId, branchName, baseBranch, model, provider),

  gitBranch: (cwd: string) => ipcRenderer.invoke('git:branch', cwd),
  listGitBranches: (cwd: string) => ipcRenderer.invoke('git:list-branches', cwd),
  cleanupWorktree: (sourceDir: string, worktreePath: string, deleteBranch: boolean) =>
    ipcRenderer.invoke('worktree:cleanup', sourceDir, worktreePath, deleteBranch),
  gitStatus: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
  gitDiff: (cwd: string, filePath: string) => ipcRenderer.invoke('git:diff', cwd, filePath),
  openDiffWindow: (cwd: string, filePath: string) => ipcRenderer.invoke('diff:open', cwd, filePath),
  onDiffData: (callback: (data: { filePath: string; oldContent: string; newContent: string; cwd: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('diff:data', handler)
    return () => ipcRenderer.removeListener('diff:data', handler)
  },
  signalDiffReady: () => ipcRenderer.send('diff:ready'),
  getDiffData: () => ipcRenderer.invoke('diff:get-data'),
  switchDiffFile: (filePath: string) => ipcRenderer.invoke('diff:switch-file', filePath),
  getContextUsage: (sessionId: string, workingDirectory: string) =>
    ipcRenderer.invoke('session:context-usage', sessionId, workingDirectory),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('fs:read-directory', dirPath),
  readFileContent: (filePath: string, maxBytes?: number) =>
    ipcRenderer.invoke('fs:read-file-content', filePath, maxBytes),
  openFile: (filePath: string) => ipcRenderer.invoke('fs:open-file', filePath),
  // Agent Collaboration
  collabCreate: (name: string, participantIds: string[]) => ipcRenderer.invoke('collab:create', name, participantIds),
  collabList: () => ipcRenderer.invoke('collab:list'),
  collabGet: (sessionId: string) => ipcRenderer.invoke('collab:get', sessionId),
  collabSend: (sessionId: string, fromTerminalId: string, content: string) => ipcRenderer.invoke('collab:send', sessionId, fromTerminalId, content),
  collabUpdatePlan: (sessionId: string, plan: string) => ipcRenderer.invoke('collab:update-plan', sessionId, plan),
  collabApprove: (sessionId: string) => ipcRenderer.invoke('collab:approve', sessionId),
  collabDelete: (sessionId: string) => ipcRenderer.invoke('collab:delete', sessionId),
  onCollabMessage: (callback: (sessionId: string, msg: any) => void) => {
    const handler = (_event: any, sessionId: string, msg: any) => callback(sessionId, msg)
    ipcRenderer.on('collab:message', handler)
    return () => ipcRenderer.removeListener('collab:message', handler)
  },
  onCollabPlanUpdated: (callback: (sessionId: string, plan: string) => void) => {
    const handler = (_event: any, sessionId: string, plan: string) => callback(sessionId, plan)
    ipcRenderer.on('collab:plan-updated', handler)
    return () => ipcRenderer.removeListener('collab:plan-updated', handler)
  },
  onCollabApproved: (callback: (sessionId: string) => void) => {
    const handler = (_event: any, sessionId: string) => callback(sessionId)
    ipcRenderer.on('collab:approved', handler)
    return () => ipcRenderer.removeListener('collab:approved', handler)
  },

  // Collab Orchestrator v2
  collabV2Create: (name: string, agentIds: string[], maxRounds?: number) => ipcRenderer.invoke('collab-v2:create', name, agentIds, maxRounds),
  collabV2Start: (sessionId: string, prompt: string) => ipcRenderer.invoke('collab-v2:start', sessionId, prompt),
  collabV2Intervene: (sessionId: string, message: string) => ipcRenderer.invoke('collab-v2:intervene', sessionId, message),
  collabV2Approve: (sessionId: string) => ipcRenderer.invoke('collab-v2:approve', sessionId),
  collabV2Get: (sessionId: string) => ipcRenderer.invoke('collab-v2:get', sessionId),
  collabV2List: () => ipcRenderer.invoke('collab-v2:list'),
  collabV2Delete: (sessionId: string) => ipcRenderer.invoke('collab-v2:delete', sessionId),
  onCollabV2Turn: (callback: (sessionId: string, turn: any) => void) => {
    const handler = (_event: any, sessionId: string, turn: any) => callback(sessionId, turn)
    ipcRenderer.on('collab:orchestrator-turn', handler)
    return () => ipcRenderer.removeListener('collab:orchestrator-turn', handler)
  },
  onCollabV2MaxRounds: (callback: (sessionId: string) => void) => {
    const handler = (_event: any, sessionId: string) => callback(sessionId)
    ipcRenderer.on('collab:orchestrator-max-rounds', handler)
    return () => ipcRenderer.removeListener('collab:orchestrator-max-rounds', handler)
  },
  onCollabV2Approved: (callback: (sessionId: string, plan: string) => void) => {
    const handler = (_event: any, sessionId: string, plan: string) => callback(sessionId, plan)
    ipcRenderer.on('collab:orchestrator-approved', handler)
    return () => ipcRenderer.removeListener('collab:orchestrator-approved', handler)
  },

  // Projects
  pinProject: (directory: string, name?: string) => ipcRenderer.invoke('projects:pin', directory, name),
  unpinProject: (id: string) => ipcRenderer.invoke('projects:unpin', id),
  unpinProjectByDir: (directory: string) => ipcRenderer.invoke('projects:unpin-by-dir', directory),
  listPinnedProjects: () => ipcRenderer.invoke('projects:list-pinned'),
  listRecentProjects: (limit?: number) => ipcRenderer.invoke('projects:list-recent', limit),
  isProjectPinned: (directory: string) => ipcRenderer.invoke('projects:is-pinned', directory),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  onTerminalData: (callback: (id: string, data: string) => void) => {
    const handler = (_event: any, id: string, data: string) => callback(id, data)
    ipcRenderer.on('terminal:data', handler)
    return () => ipcRenderer.removeListener('terminal:data', handler)
  },
  onTerminalExit: (callback: (id: string) => void) => {
    const handler = (_event: any, id: string) => callback(id)
    ipcRenderer.on('terminal:exit', handler)
    return () => ipcRenderer.removeListener('terminal:exit', handler)
  },
  onTerminalTitleUpdated: (callback: (id: string, title: string) => void) => {
    const handler = (_event: any, id: string, title: string) => callback(id, title)
    ipcRenderer.on('terminal:title-updated', handler)
    return () => ipcRenderer.removeListener('terminal:title-updated', handler)
  },
  onSessionIdUpdated: (callback: (id: string, sessionId: string) => void) => {
    const handler = (_event: any, id: string, sessionId: string) => callback(id, sessionId)
    ipcRenderer.on('terminal:session-id-updated', handler)
    return () => ipcRenderer.removeListener('terminal:session-id-updated', handler)
  },
  onNewTerminalShortcut: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('shortcut:new-chat', handler)
    return () => ipcRenderer.removeListener('shortcut:new-chat', handler)
  },
  onCloseTerminalShortcut: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('shortcut:close-chat', handler)
    return () => ipcRenderer.removeListener('shortcut:close-chat', handler)
  },
  onCommandPaletteShortcut: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('shortcut:command-palette', handler)
    return () => ipcRenderer.removeListener('shortcut:command-palette', handler)
  },
  onSwitchChatShortcut: (callback: (index: number) => void) => {
    const handler = (_event: any, index: number) => callback(index)
    ipcRenderer.on('shortcut:switch-chat', handler)
    return () => ipcRenderer.removeListener('shortcut:switch-chat', handler)
  },
  getSessionPlan: (sessionId: string, workingDirectory: string) =>
    ipcRenderer.invoke('plans:get-session-plan', sessionId, workingDirectory),
  listPlans: () => ipcRenderer.invoke('plans:list'),
  readPlan: (name: string) => ipcRenderer.invoke('plans:read', name),
  voiceStart: () => ipcRenderer.invoke('voice:start'),
  voiceStop: () => ipcRenderer.invoke('voice:stop'),
  voiceCancel: () => ipcRenderer.invoke('voice:cancel'),
  onVoicePartial: (callback: (text: string) => void) => {
    const handler = (_event: any, text: string) => callback(text)
    ipcRenderer.on('voice:partial', handler)
    return () => ipcRenderer.removeListener('voice:partial', handler)
  },
  onVoiceFinal: (callback: (text: string) => void) => {
    const handler = (_event: any, text: string) => callback(text)
    ipcRenderer.on('voice:final', handler)
    return () => ipcRenderer.removeListener('voice:final', handler)
  },
  onVoiceError: (callback: (error: string) => void) => {
    const handler = (_event: any, error: string) => callback(error)
    ipcRenderer.on('voice:error', handler)
    return () => ipcRenderer.removeListener('voice:error', handler)
  },
  onToggleExplorerShortcut: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('shortcut:toggle-explorer', handler)
    return () => ipcRenderer.removeListener('shortcut:toggle-explorer', handler)
  },

  // Web Remote
  webRemoteStart: (port?: number) => ipcRenderer.invoke('web-remote:start', port),
  webRemoteStop: () => ipcRenderer.invoke('web-remote:stop'),
  webRemoteStatus: () => ipcRenderer.invoke('web-remote:status')
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('webUtils', {
  getPathForFile: (file: File) => webUtils.getPathForFile(file)
})
