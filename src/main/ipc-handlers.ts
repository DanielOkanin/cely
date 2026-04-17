import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { execSync, spawn, ChildProcess } from 'child_process'
import { readFileSync, readdirSync, statSync, openSync, readSync, fstatSync, closeSync } from 'fs'
import { join, resolve, basename } from 'path'
import { homedir } from 'os'
import { is } from '@electron-toolkit/utils'
import { ChatStore } from './services/chat-store'
import { TerminalService } from './services/terminal-service'
import { WorktreeService } from './services/worktree-service'
import { generateSummary } from './services/conversation-summarizer'
import { getProvider } from './providers'
import type { AgentProviderId } from './providers/types'
import type { TerminalListener, AppServices } from './services/web-remote-server'

import { AgentCollabService } from './services/agent-collab'
import { CollabOrchestrator } from './services/collab-orchestrator'

export function registerIpcHandlers(mainWindow: BrowserWindow): AppServices {
  const chatStore = new ChatStore()
  const terminalService = new TerminalService()
  const worktreeService = new WorktreeService()
  const collabService = new AgentCollabService()
  const collabOrchestrator = new CollabOrchestrator(terminalService)

  // Wire orchestrator events to renderer
  collabOrchestrator.on('turn:complete', (sessionId, turn) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('collab:orchestrator-turn', sessionId, turn)
    }
  })
  collabOrchestrator.on('planning:max-rounds', (sessionId) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('collab:orchestrator-max-rounds', sessionId)
    }
  })
  collabOrchestrator.on('plan:approved', (sessionId, plan) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('collab:orchestrator-approved', sessionId, plan)
    }
  })
  collabOrchestrator.on('message:sent', (sessionId, agentId, message) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('collab:orchestrator-sent', sessionId, agentId, message)
    }
  })

  // --- Terminal event broadcasting ---
  const terminalListeners: TerminalListener[] = []

  function addTerminalListener(listener: TerminalListener): () => void {
    terminalListeners.push(listener)
    return () => {
      const idx = terminalListeners.indexOf(listener)
      if (idx >= 0) terminalListeners.splice(idx, 1)
    }
  }

  function broadcastData(id: string, data: string): void {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:data', id, data)
    for (const l of terminalListeners) l.onData(id, data)
    // Feed to collab orchestrator
    collabOrchestrator.onAgentOutput(id, data)
  }

  function broadcastExit(id: string): void {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:exit', id)
    for (const l of terminalListeners) l.onExit(id)
  }

  function broadcastTitleUpdate(id: string, title: string): void {
    chatStore.updateTitle(id, title)
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:title-updated', id, title)
    for (const l of terminalListeners) l.onTitleUpdate(id, title)
  }

  // Auto-title handler
  terminalService.setTitleUpdateHandler((id, title) => {
    broadcastTitleUpdate(id, title)
  })

  // --- Shared terminal operations ---
  function createTerminalSession(workingDirectory: string, model?: string, providerId?: string) {
    const provider = providerId as AgentProviderId | undefined
    const session = chatStore.createChat(workingDirectory, model, provider)
    terminalService.createTerminal(
      session.id, workingDirectory, session.model, false, session.sessionId,
      (data) => broadcastData(session.id, data),
      () => broadcastExit(session.id),
      session.provider
    )
    return session
  }

  function reconnectTerminalSession(id: string): boolean {
    const session = chatStore.getChat(id)
    if (!session) return false
    const providerConfig = getProvider(session.provider)
    // For providers without session resume, start fresh
    const resume = providerConfig.capabilities.sessionResume
    terminalService.createTerminal(
      id, session.workingDirectory, session.model, resume, session.sessionId,
      (data) => broadcastData(id, data),
      () => broadcastExit(id),
      session.provider
    )
    return true
  }

  async function forkTerminalSession(sourceId: string) {
    const source = chatStore.getChat(sourceId)
    if (!source) return null

    // Only Claude supports fork via agent SDK
    const sourceProvider = getProvider(source.provider)
    if (!sourceProvider.capabilities.sessionFork) return null

    console.log('[fork] Starting summary generation for session', source.sessionId)
    const summary = await generateSummary(source.sessionId, source.workingDirectory)
    console.log('[fork] Summary generated, length:', summary?.length ?? 0)

    if (!summary) {
      console.log('[fork] Summary generation returned null, aborting fork')
      return null
    }

    const newSession = chatStore.createChat(source.workingDirectory, source.model)
    const forkTitle = `Fork — ${source.title}`
    broadcastTitleUpdate(newSession.id, forkTitle)
    newSession.title = forkTitle

    let readyTimer: ReturnType<typeof setTimeout> | null = null
    let summarySent = false

    terminalService.createTerminal(
      newSession.id, source.workingDirectory, newSession.model, false, newSession.sessionId,
      (data: string) => {
        broadcastData(newSession.id, data)
        if (summarySent) return
        if (readyTimer) clearTimeout(readyTimer)
        readyTimer = setTimeout(() => {
          if (summarySent) return
          summarySent = true
          console.log('[fork] Terminal ready, sending summary', newSession.id)
          const message = `Here is a summary of a previous conversation to continue from:\n\n${summary}\n\nPlease review this context and let me know you're ready to continue.`
          terminalService.write(newSession.id, `\x1b[200~${message}\x1b[201~`)
          setTimeout(() => terminalService.write(newSession.id, '\r'), 100)
        }, 1500)
      },
      () => broadcastExit(newSession.id),
      newSession.provider
    )

    return newSession
  }

  // --- IPC Handlers ---
  ipcMain.handle('terminal:create', (_event, workingDirectory: string, model?: string, provider?: string) => {
    return createTerminalSession(workingDirectory, model, provider)
  })

  ipcMain.handle('terminal:list', () => chatStore.listChats())

  ipcMain.handle('terminal:delete', (_event, id: string) => {
    const session = chatStore.getChat(id)
    terminalService.destroy(id)
    chatStore.deleteChat(id)

    // Check if this was the last session in a worktree (skip if part of a feature — feature:close handles cleanup)
    if (session?.worktreePath && !session.featureId) {
      const remaining = chatStore.getSessionsByWorktreePath(session.worktreePath)
      if (remaining.length === 0) {
        const branchName = worktreeService.getCurrentBranch(session.worktreePath)
        return {
          wasLastWorktreeSession: true,
          worktreePath: session.worktreePath,
          sourceDirectory: session.sourceDirectory,
          branchName
        }
      }
    }
    return { wasLastWorktreeSession: false }
  })

  ipcMain.handle('terminal:rename', (_event, id: string, title: string) => {
    chatStore.updateTitle(id, title)
  })

  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    terminalService.write(id, data)
  })

  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    terminalService.resize(id, cols, rows)
  })

  ipcMain.handle('terminal:reconnect', (_event, id: string) => {
    return reconnectTerminalSession(id)
  })

  ipcMain.handle('terminal:fork', async (_event, sourceId: string) => {
    return forkTerminalSession(sourceId)
  })

  ipcMain.handle('terminal:create-on-branch', (_event, sourceDir: string, branchName: string, baseBranch?: string, model?: string, provider?: string) => {
    const repoRoot = worktreeService.getRepoRoot(sourceDir) || sourceDir
    const worktreePath = worktreeService.createWorktree(repoRoot, branchName, baseBranch)
    const p = provider as AgentProviderId | undefined
    const session = chatStore.createChat(worktreePath, model, p, worktreePath, repoRoot)
    terminalService.createTerminal(
      session.id, worktreePath, session.model, false, session.sessionId,
      (data) => broadcastData(session.id, data),
      () => broadcastExit(session.id),
      session.provider
    )
    return session
  })

  ipcMain.handle('git:list-branches', (_event, cwd: string) => {
    const repoRoot = worktreeService.getRepoRoot(cwd) || cwd
    return worktreeService.listBranches(repoRoot)
  })

  ipcMain.handle('worktree:cleanup', (_event, sourceDir: string, worktreePath: string, deleteBranch: boolean) => {
    worktreeService.removeWorktree(sourceDir, worktreePath, deleteBranch)
  })

  // --- Feature handlers ---

  ipcMain.handle('feature:create', (_event, name: string, directory: string) => {
    return chatStore.createFeature(name, directory)
  })

  ipcMain.handle('feature:list', () => chatStore.listFeatures())

  ipcMain.handle('feature:rename', (_event, id: string, name: string) => {
    chatStore.renameFeature(id, name)
  })

  ipcMain.handle('feature:close', (_event, id: string) => {
    const feature = chatStore.getFeature(id)
    if (!feature) return { deletedSessionIds: [] }

    const sessions = chatStore.getSessionsByFeatureId(id)
    const deletedSessionIds: string[] = []
    const worktreePaths = new Set<string>()

    // Kill terminals and delete sessions
    for (const session of sessions) {
      terminalService.destroy(session.id)
      chatStore.deleteChat(session.id)
      deletedSessionIds.push(session.id)
      broadcastExit(session.id)
      if (session.worktreePath) worktreePaths.add(session.worktreePath)
    }

    // Clean up worktrees
    for (const wt of worktreePaths) {
      try {
        worktreeService.removeWorktree(feature.directory, wt, false)
      } catch { /* worktree may already be gone */ }
    }

    chatStore.deleteFeature(id)
    return { deletedSessionIds }
  })

  ipcMain.handle('feature:create-chat', (_event, featureId: string, model?: string, provider?: string) => {
    const feature = chatStore.getFeature(featureId)
    if (!feature) return null
    const p = provider as AgentProviderId | undefined
    const session = chatStore.createChat(feature.directory, model, p, undefined, undefined, featureId)
    terminalService.createTerminal(
      session.id, feature.directory, session.model, false, session.sessionId,
      (data) => broadcastData(session.id, data),
      () => broadcastExit(session.id),
      session.provider
    )
    return session
  })

  ipcMain.handle('feature:create-chat-on-branch', (_event, featureId: string, branchName: string, baseBranch?: string, model?: string, provider?: string) => {
    const feature = chatStore.getFeature(featureId)
    if (!feature) return null
    const repoRoot = worktreeService.getRepoRoot(feature.directory) || feature.directory
    const worktreePath = worktreeService.createWorktree(repoRoot, branchName, baseBranch)
    const p = provider as AgentProviderId | undefined
    const session = chatStore.createChat(worktreePath, model, p, worktreePath, repoRoot, featureId)
    terminalService.createTerminal(
      session.id, worktreePath, session.model, false, session.sessionId,
      (data) => broadcastData(session.id, data),
      () => broadcastExit(session.id),
      session.provider
    )
    return session
  })

  ipcMain.handle('git:branch', (_event, cwd: string) => {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd, encoding: 'utf-8', timeout: 3000
      }).trim()
    } catch { return null }
  })

  ipcMain.handle('git:status', (_event, cwd: string) => {
    try {
      const output = execSync('git status --porcelain -uall', {
        cwd, encoding: 'utf-8', timeout: 5000
      }).trim()
      if (!output) return []
      return output.split('\n').filter(line => line.length > 3).map((line) => {
        const status = line.substring(0, 2)
        let filePath = line.substring(3)
        let type: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
        if (status === '??') type = 'untracked'
        else if (status.includes('D')) type = 'deleted'
        else if (status.includes('A')) type = 'added'
        else if (status.includes('R')) {
          type = 'renamed'
          const parts = filePath.split(' -> ')
          if (parts.length === 2) filePath = parts[1]
        }
        else type = 'modified'
        if (filePath.startsWith('"') && filePath.endsWith('"')) filePath = filePath.slice(1, -1)
        return { status: status.trim(), filePath, type }
      })
    } catch { return [] }
  })

  ipcMain.handle('git:diff', (_event, cwd: string, filePath: string) => {
    try {
      let diff = ''
      try { diff = execSync(`git diff -- "${filePath}"`, { cwd, encoding: 'utf-8', timeout: 5000 }) } catch { /* */ }
      if (!diff) { try { diff = execSync(`git diff --cached -- "${filePath}"`, { cwd, encoding: 'utf-8', timeout: 5000 }) } catch { /* */ } }
      if (!diff) { try { diff = execSync(`git diff HEAD -- "${filePath}"`, { cwd, encoding: 'utf-8', timeout: 5000 }) } catch { /* */ } }
      return diff || null
    } catch { return null }
  })

  // Diff viewer
  const pendingDiffDataMap = new Map<number, { filePath: string; oldContent: string; newContent: string; cwd: string; allFiles: string[] }>()

  function getDiffContents(repoRoot: string, filePath: string): { oldContent: string; newContent: string } {
    let headContent = '', indexContent = '', diskContent = ''
    try { headContent = execSync(`git show HEAD:"${filePath}"`, { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }) } catch { /* */ }
    try { indexContent = execSync(`git show :"${filePath}"`, { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }) } catch { /* */ }
    try { diskContent = readFileSync(join(repoRoot, filePath), 'utf-8') } catch { /* */ }
    if (diskContent !== headContent) return { oldContent: headContent, newContent: diskContent }
    else if (indexContent !== headContent) return { oldContent: headContent, newContent: indexContent }
    else return { oldContent: headContent, newContent: diskContent }
  }

  ipcMain.handle('diff:open', async (_event, cwd: string, filePath: string) => {
    let repoRoot = cwd
    try { repoRoot = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf-8', timeout: 5000 }).trim() } catch { /* */ }

    let allFiles: string[] = []
    try {
      const output = execSync('git status --porcelain -uall', { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim()
      if (output) {
        allFiles = output.split('\n').filter(line => line.length > 3).map(line => {
          let fp = line.substring(3)
          if (line.substring(0, 2).includes('R')) { const parts = fp.split(' -> '); if (parts.length === 2) fp = parts[1] }
          if (fp.startsWith('"') && fp.endsWith('"')) fp = fp.slice(1, -1)
          return fp
        })
      }
    } catch { /* */ }

    const { oldContent, newContent } = getDiffContents(repoRoot, filePath)

    const diffWindow = new BrowserWindow({
      width: 1200, height: 800, title: `Diff: ${filePath}`,
      titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 16 },
      webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
    })

    const wcId = diffWindow.webContents.id
    pendingDiffDataMap.set(wcId, { filePath, oldContent, newContent, cwd, allFiles })
    diffWindow.on('closed', () => pendingDiffDataMap.delete(wcId))

    const url = is.dev && process.env['ELECTRON_RENDERER_URL']
      ? `${process.env['ELECTRON_RENDERER_URL']}#/diff`
      : `file://${join(__dirname, '../renderer/index.html')}#/diff`
    await diffWindow.loadURL(url)
  })

  ipcMain.handle('diff:switch-file', (event, filePath: string) => {
    const existing = pendingDiffDataMap.get(event.sender.id)
    if (!existing) return null
    let repoRoot = existing.cwd
    try { repoRoot = execSync('git rev-parse --show-toplevel', { cwd: existing.cwd, encoding: 'utf-8', timeout: 5000 }).trim() } catch { /* */ }
    const { oldContent, newContent } = getDiffContents(repoRoot, filePath)
    const updated = { ...existing, filePath, oldContent, newContent }
    pendingDiffDataMap.set(event.sender.id, updated)
    return updated
  })

  ipcMain.handle('diff:get-data', (event) => pendingDiffDataMap.get(event.sender.id) ?? null)

  ipcMain.on('window:set-title', (_event, title: string) => {
    if (!mainWindow.isDestroyed()) mainWindow.setTitle(title)
  })

  ipcMain.handle('session:context-usage', (_event, sessionId: string, workingDirectory: string) => {
    try {
      const projectKey = workingDirectory.replace(/\//g, '-')
      const sessionFile = join(homedir(), '.claude', 'projects', projectKey, `${sessionId}.jsonl`)
      const fd = openSync(sessionFile, 'r')
      let tail: string
      try {
        const stat = fstatSync(fd)
        const readSize = Math.min(stat.size, 32768)
        const buffer = Buffer.alloc(readSize)
        readSync(fd, buffer, 0, readSize, stat.size - readSize)
        tail = buffer.toString('utf-8')
      } finally { closeSync(fd) }
      const lines = tail.trim().split('\n')
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const data = JSON.parse(lines[i])
          const usage = data.message?.usage
          if (usage) {
            const contextUsed = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0)
            return { contextUsed, outputTokens: usage.output_tokens || 0, model: data.message?.model || null }
          }
        } catch { continue }
      }
      return null
    } catch { return null }
  })

  const planRefsCache = new Map<string, { size: number; refs: Set<string> }>()

  ipcMain.handle('plans:get-session-plan', (_event, sessionId: string, workingDirectory: string) => {
    try {
      const projectKey = workingDirectory.replace(/\//g, '-')
      const sessionFile = join(homedir(), '.claude', 'projects', projectKey, `${sessionId}.jsonl`)
      const plansDir = join(homedir(), '.claude', 'plans')
      const fileStat = statSync(sessionFile)
      const cached = planRefsCache.get(sessionFile)
      let planRefs: Set<string>
      if (cached && cached.size === fileStat.size) {
        planRefs = cached.refs
      } else {
        const content = readFileSync(sessionFile, 'utf-8')
        planRefs = new Set<string>()
        for (const line of content.split('\n')) {
          const matches = line.matchAll(/\.claude\/plans\/([a-z0-9-]+\.md)/g)
          for (const m of matches) planRefs.add(m[1])
        }
        planRefsCache.set(sessionFile, { size: fileStat.size, refs: planRefs })
      }
      if (planRefs.size === 0) return null
      let bestPlan: { name: string; content: string; modifiedAt: number } | null = null
      for (const name of planRefs) {
        try {
          const fp = join(plansDir, name)
          const stat = statSync(fp)
          const planContent = readFileSync(fp, 'utf-8')
          if (!bestPlan || stat.mtimeMs > bestPlan.modifiedAt) {
            bestPlan = { name, content: planContent, modifiedAt: stat.mtimeMs }
          }
        } catch { /* plan deleted */ }
      }
      return bestPlan
    } catch { return null }
  })

  ipcMain.handle('plans:list', () => {
    try {
      const plansDir = join(homedir(), '.claude', 'plans')
      const files = readdirSync(plansDir).filter(f => f.endsWith('.md'))
      return files.map(name => {
        const fp = join(plansDir, name)
        const stat = statSync(fp)
        const fd = openSync(fp, 'r')
        const buf = Buffer.alloc(512)
        const bytesRead = readSync(fd, buf, 0, 512, 0)
        closeSync(fd)
        const head = buf.toString('utf-8', 0, bytesRead)
        const titleMatch = head.match(/^#\s+(.+)/m)
        return { name, title: titleMatch ? titleMatch[1] : name.replace('.md', ''), modifiedAt: stat.mtimeMs }
      }).sort((a, b) => b.modifiedAt - a.modifiedAt)
    } catch { return [] }
  })

  ipcMain.handle('plans:read', (_event, name: string) => {
    try {
      const plansDir = join(homedir(), '.claude', 'plans')
      const safeName = basename(name)
      const fp = resolve(plansDir, safeName)
      if (!fp.startsWith(plansDir)) return null
      return readFileSync(fp, 'utf-8')
    } catch { return null }
  })

  // File explorer
  ipcMain.handle('fs:read-directory', (_event, dirPath: string) => {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true })
      const filtered = entries.filter(e =>
        e.name !== '.git' && e.name !== 'node_modules' && e.name !== '.DS_Store' && !e.name.startsWith('.')
      )
      const result = filtered.map(e => ({
        name: e.name, path: join(dirPath, e.name), isDirectory: e.isDirectory()
      }))
      result.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return result
    } catch { return [] }
  })

  ipcMain.handle('fs:read-file-content', (_event, filePath: string, maxBytes?: number) => {
    try {
      const max = maxBytes || 102400
      const stat = statSync(filePath)
      const truncated = stat.size > max
      const fd = openSync(filePath, 'r')
      const readSize = Math.min(stat.size, max)
      const buffer = Buffer.alloc(readSize)
      readSync(fd, buffer, 0, readSize, 0)
      closeSync(fd)
      const checkSize = Math.min(readSize, 8192)
      let isBinary = false
      for (let i = 0; i < checkSize; i++) {
        if (buffer[i] === 0) { isBinary = true; break }
      }
      return { content: isBinary ? '' : buffer.toString('utf-8'), isBinary, truncated }
    } catch { return { content: '', isBinary: false, truncated: false } }
  })

  ipcMain.handle('fs:open-file', (_event, filePath: string) => shell.openPath(filePath))

  // --- Agent Collaboration ---

  ipcMain.handle('collab:create', (_event, name: string, participantIds: string[]) => {
    const session = collabService.createSession(name, participantIds)
    return session
  })

  ipcMain.handle('collab:list', () => {
    return collabService.listSessions()
  })

  ipcMain.handle('collab:get', (_event, sessionId: string) => {
    return collabService.getSession(sessionId)
  })

  ipcMain.handle('collab:send', (_event, sessionId: string, fromTerminalId: string, content: string) => {
    const terminal = chatStore.getChat(fromTerminalId)
    if (!terminal) return null
    const providerConfig = getProvider(terminal.provider)
    const fromLabel = `${providerConfig.displayName} (${terminal.title})`

    const msg = collabService.sendMessage(sessionId, fromTerminalId, fromLabel, content)
    if (!msg) return null

    // Relay to other participants by injecting into their terminals
    const session = collabService.getSession(sessionId)
    if (session) {
      for (const participantId of session.participants) {
        if (participantId === fromTerminalId) continue
        const relayText = collabService.buildRelayPrompt(msg, session.plan)
        // Paste into the other agent's terminal using bracketed paste
        terminalService.write(participantId, `\x1b[200~${relayText}\x1b[201~`)
        setTimeout(() => terminalService.write(participantId, '\r'), 200)
      }
    }

    // Broadcast to renderer
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('collab:message', sessionId, msg)
    }

    return msg
  })

  ipcMain.handle('collab:update-plan', (_event, sessionId: string, plan: string) => {
    collabService.updatePlan(sessionId, plan)
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('collab:plan-updated', sessionId, plan)
    }
  })

  ipcMain.handle('collab:approve', (_event, sessionId: string) => {
    collabService.approvePlan(sessionId)
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('collab:approved', sessionId)
    }
  })

  ipcMain.handle('collab:delete', (_event, sessionId: string) => {
    collabService.deleteSession(sessionId)
  })

  // --- Collab Orchestrator (v2) ---

  ipcMain.handle('collab-v2:create', (_event, name: string, agentIds: string[], maxRounds?: number) => {
    const agents = agentIds.map((id) => {
      const chat = chatStore.getChat(id)
      const provider = chat ? getProvider(chat.provider) : null
      return { id, label: `${provider?.displayName || 'Agent'} (${chat?.title || id})` }
    })
    return collabOrchestrator.createSession(name, agents, maxRounds)
  })

  ipcMain.handle('collab-v2:start', (_event, sessionId: string, prompt: string) => {
    collabOrchestrator.startPlanning(sessionId, prompt)
  })

  ipcMain.handle('collab-v2:intervene', (_event, sessionId: string, message: string) => {
    collabOrchestrator.userIntervene(sessionId, message)
  })

  ipcMain.handle('collab-v2:approve', (_event, sessionId: string) => {
    collabOrchestrator.approvePlan(sessionId)
  })

  ipcMain.handle('collab-v2:get', (_event, sessionId: string) => {
    return collabOrchestrator.getSession(sessionId)
  })

  ipcMain.handle('collab-v2:list', () => {
    return collabOrchestrator.listSessions()
  })

  ipcMain.handle('collab-v2:delete', (_event, sessionId: string) => {
    collabOrchestrator.deleteSession(sessionId)
  })

  // --- Pinned/Recent Projects ---

  ipcMain.handle('projects:pin', (_event, directory: string, name?: string) => {
    return chatStore.pinProject(directory, name)
  })

  ipcMain.handle('projects:unpin', (_event, id: string) => {
    chatStore.unpinProject(id)
  })

  ipcMain.handle('projects:unpin-by-dir', (_event, directory: string) => {
    chatStore.unpinProjectByDir(directory)
  })

  ipcMain.handle('projects:list-pinned', () => {
    return chatStore.listPinnedProjects()
  })

  ipcMain.handle('projects:list-recent', (_event, limit?: number) => {
    return chatStore.getRecentDirectories(limit || 10)
  })

  ipcMain.handle('projects:is-pinned', (_event, directory: string) => {
    return chatStore.isPinned(directory)
  })

  ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Voice transcription
  let transcribeProcess: ChildProcess | null = null
  const transcribeBinary = join(__dirname, '../../resources/transcribe')

  ipcMain.handle('voice:start', () => {
    if (transcribeProcess) return false
    transcribeProcess = spawn(transcribeBinary, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    transcribeProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        if (line.startsWith('PARTIAL:')) mainWindow.webContents.send('voice:partial', line.slice(8))
        else if (line.startsWith('FINAL:')) {
          mainWindow.webContents.send('voice:final', line.slice(6))
          transcribeProcess = null
        }
      }
    })
    transcribeProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg.startsWith('ERROR:')) mainWindow.webContents.send('voice:error', msg.slice(7))
    })
    transcribeProcess.on('exit', () => { transcribeProcess = null })
    return true
  })

  ipcMain.handle('voice:stop', () => {
    if (transcribeProcess?.stdin) transcribeProcess.stdin.write('STOP\n')
  })

  ipcMain.handle('voice:cancel', () => {
    if (transcribeProcess) { transcribeProcess.kill(); transcribeProcess = null }
  })

  // Cleanup
  mainWindow.on('closed', () => {
    if (transcribeProcess) { transcribeProcess.kill(); transcribeProcess = null }
    terminalService.destroyAll()
  })

  return {
    chatStore,
    terminalService,
    createTerminalSession,
    reconnectTerminalSession,
    forkTerminalSession,
    addTerminalListener
  }
}
