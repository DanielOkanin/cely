import express from 'express'
import { createServer, Server } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'
import { join, resolve, basename } from 'path'
import { execSync } from 'child_process'
import { readFileSync, readdirSync, statSync, openSync, readSync, fstatSync, closeSync } from 'fs'
import { homedir } from 'os'
import * as QRCode from 'qrcode'
import type { ChatStore } from './chat-store'
import type { TerminalService } from './terminal-service'
import type { TerminalSession } from '../types'
import { getProvider } from '../providers'

export interface TerminalListener {
  onData(id: string, data: string): void
  onExit(id: string): void
  onTitleUpdate(id: string, title: string): void
}

export interface AppServices {
  chatStore: ChatStore
  terminalService: TerminalService
  createTerminalSession(workingDirectory: string, model?: string, provider?: string): TerminalSession
  reconnectTerminalSession(id: string): boolean
  forkTerminalSession(sourceId: string): Promise<TerminalSession | null>
  addTerminalListener(listener: TerminalListener): () => void
}

export class WebRemoteServer {
  private server: Server | null = null
  private wss: WebSocketServer | null = null
  private token: string | null = null
  private port: number | null = null
  private clients = new Set<WebSocket>()
  private outputBuffers = new Map<string, string[]>()
  private maxBufferSize = 65536
  private unregisterListener: (() => void) | null = null

  constructor(private services: AppServices) {}

  async start(port: number = 3131): Promise<{ port: number; token: string; url: string; qrDataUrl: string }> {
    if (this.server) throw new Error('Server is already running')

    this.token = randomBytes(32).toString('hex')
    this.port = port

    const app = express()
    app.use(express.json())

    // Serve static web client
    const staticDir = join(__dirname, '../../resources/web-remote')
    app.use(express.static(staticDir))

    // Auth middleware
    const auth: express.RequestHandler = (req, res, next) => {
      const header = req.headers.authorization
      if (header === `Bearer ${this.token}`) return next()
      res.status(401).json({ error: 'Unauthorized' })
    }

    // API routes
    const api = express.Router()
    api.use(auth)
    this.setupRoutes(api)
    app.use('/api/v1', api)

    // SPA fallback (Express 5 requires named wildcard)
    app.use((_req, res) => {
      res.sendFile(join(staticDir, 'index.html'))
    })

    this.server = createServer(app)

    // WebSocket
    this.wss = new WebSocketServer({ noServer: true })

    this.server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`)
      if (url.searchParams.get('token') !== this.token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      this.wss!.handleUpgrade(request, socket, head, (ws) => {
        this.wss!.emit('connection', ws)
      })
    })

    this.wss.on('connection', (ws) => {
      this.clients.add(ws)
      ws.on('message', (raw) => {
        try {
          this.handleWsMessage(ws, JSON.parse(raw.toString()))
        } catch { /* ignore malformed */ }
      })
      ws.on('close', () => this.clients.delete(ws))
    })

    // Listen for terminal events
    this.unregisterListener = this.services.addTerminalListener({
      onData: (id, data) => {
        this.appendBuffer(id, data)
        this.broadcast({ type: 'terminal:data', id, data })
      },
      onExit: (id) => {
        this.broadcast({ type: 'terminal:exit', id })
      },
      onTitleUpdate: (id, title) => {
        this.broadcast({ type: 'terminal:title-updated', id, title })
      }
    })

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(port, '0.0.0.0', () => resolve())
      this.server!.on('error', reject)
    })

    const localIp = this.getLocalIp()
    const url = `http://${localIp}:${port}?token=${this.token}`
    const qrDataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2 })

    console.log(`[web-remote] Server started at ${url}`)
    return { port, token: this.token, url, qrDataUrl }
  }

  stop(): void {
    if (this.unregisterListener) {
      this.unregisterListener()
      this.unregisterListener = null
    }
    for (const client of this.clients) client.close()
    this.clients.clear()
    this.outputBuffers.clear()
    this.wss?.close()
    this.wss = null
    this.server?.close()
    this.server = null
    this.token = null
    this.port = null
    console.log('[web-remote] Server stopped')
  }

  getStatus(): { running: boolean; port: number | null; connectedClients: number } {
    return {
      running: this.server !== null,
      port: this.port,
      connectedClients: this.clients.size
    }
  }

  private setupRoutes(api: express.Router): void {
    const { chatStore, terminalService } = this.services

    // --- Terminals ---
    api.get('/terminals', (_req, res) => {
      res.json(chatStore.listChats())
    })

    api.post('/terminals', (req, res): void => {
      const { workingDirectory, model, provider } = req.body
      if (!workingDirectory) { res.status(400).json({ error: 'workingDirectory required' }); return }
      const session = this.services.createTerminalSession(workingDirectory, model, provider)
      res.json(session)
    })

    api.delete('/terminals/:id', (req, res) => {
      terminalService.destroy(req.params.id)
      chatStore.deleteChat(req.params.id)
      this.outputBuffers.delete(req.params.id)
      res.json({ ok: true })
    })

    api.patch('/terminals/:id', (req, res) => {
      if (req.body.title) chatStore.updateTitle(req.params.id, req.body.title)
      res.json({ ok: true })
    })

    api.post('/terminals/:id/reconnect', (req, res) => {
      const ok = this.services.reconnectTerminalSession(req.params.id)
      res.json({ ok })
    })

    api.post('/terminals/:id/fork', async (req, res): Promise<void> => {
      const session = await this.services.forkTerminalSession(req.params.id)
      if (!session) { res.status(404).json({ error: 'Fork failed' }); return }
      res.json(session)
    })

    api.post('/terminals/:id/resize', (req, res) => {
      const { cols, rows } = req.body
      if (cols && rows) terminalService.resize(req.params.id, cols, rows)
      res.json({ ok: true })
    })

    api.get('/terminals/:id/buffer', (req, res) => {
      const chunks = this.outputBuffers.get(req.params.id) || []
      const data = chunks.join('')
      // Fall back to terminal service buffer if web remote has no data for this session
      if (!data) {
        const serviceBuffer = terminalService.getOutputBuffer(req.params.id)
        res.json({ data: serviceBuffer })
        return
      }
      res.json({ data })
    })

    // --- Git ---
    api.get('/git/branch', (req, res): void => {
      const cwd = req.query.cwd as string
      if (!cwd) { res.status(400).json({ error: 'cwd required' }); return }
      try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8', timeout: 3000 }).trim()
        res.json({ branch })
      } catch {
        res.json({ branch: null })
      }
    })

    api.get('/git/status', (req, res): void => {
      const cwd = req.query.cwd as string
      if (!cwd) { res.status(400).json({ error: 'cwd required' }); return }
      try {
        const output = execSync('git status --porcelain -uall', { cwd, encoding: 'utf-8', timeout: 5000 }).trim()
        if (!output) { res.json([]); return }
        const files = output.split('\n').filter((l) => l.length > 3).map((line) => {
          const status = line.substring(0, 2)
          let filePath = line.substring(3)
          let type: string = 'modified'
          if (status === '??') type = 'untracked'
          else if (status.includes('D')) type = 'deleted'
          else if (status.includes('A')) type = 'added'
          else if (status.includes('R')) {
            type = 'renamed'
            const parts = filePath.split(' -> ')
            if (parts.length === 2) filePath = parts[1]
          }
          if (filePath.startsWith('"') && filePath.endsWith('"')) filePath = filePath.slice(1, -1)
          return { status: status.trim(), filePath, type }
        })
        res.json(files)
      } catch {
        res.json([])
      }
    })

    // --- Conversation history (from session JSONL — Claude only) ---
    api.get('/terminals/:id/history', (req, res): void => {
      const chat = chatStore.listChats().find((c) => c.id === req.params.id)
      if (!chat || !chat.sessionId) { res.json([]); return }
      // Only Claude sessions have JSONL history
      if (chat.provider !== 'claude') { res.json([]); return }
      try {
        const projectKey = chat.workingDirectory.replace(/\//g, '-')
        const sessionFile = join(homedir(), '.claude', 'projects', projectKey, `${chat.sessionId}.jsonl`)
        const content = readFileSync(sessionFile, 'utf-8')
        const lines = content.trim().split('\n')
        const messages: { role: string; text: string }[] = []
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.type !== 'user' && data.type !== 'assistant') continue
            const msg = data.message
            if (!msg || !msg.content) continue
            let text = ''
            if (typeof msg.content === 'string') {
              text = msg.content
            } else if (Array.isArray(msg.content)) {
              text = msg.content
                .filter((b: { type: string }) => b.type === 'text')
                .map((b: { text: string }) => b.text)
                .join('\n')
            }
            text = text.trim()
            if (!text || text.length < 2) continue
            // Skip internal messages like tool results
            if (msg.role === 'user' && text.startsWith('[') && text.endsWith(']')) continue
            messages.push({ role: msg.role, text })
          } catch { continue }
        }
        res.json(messages)
      } catch {
        res.json([])
      }
    })

    // --- Context usage (Claude only) ---
    api.get('/context-usage', (req, res): void => {
      const { sessionId, cwd, provider } = req.query as Record<string, string>
      if (!sessionId || !cwd) { res.status(400).json({ error: 'sessionId and cwd required' }); return }
      // Guard: only Claude supports context usage reading
      if (provider && provider !== 'claude') {
        const providerConfig = getProvider(provider as any)
        if (!providerConfig.capabilities.contextUsage) { res.json(null); return }
      }
      try {
        const projectKey = cwd.replace(/\//g, '-')
        const sessionFile = join(homedir(), '.claude', 'projects', projectKey, `${sessionId}.jsonl`)
        const fd = openSync(sessionFile, 'r')
        const stat = fstatSync(fd)
        const readSize = Math.min(stat.size, 32768)
        const buffer = Buffer.alloc(readSize)
        readSync(fd, buffer, 0, readSize, stat.size - readSize)
        closeSync(fd)
        const lines = buffer.toString('utf-8').trim().split('\n')
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const data = JSON.parse(lines[i])
            const usage = data.message?.usage
            if (usage) {
              const contextUsed = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0)
              res.json({ contextUsed, outputTokens: usage.output_tokens || 0, model: data.message?.model || null }); return
            }
          } catch { continue }
        }
        res.json(null)
      } catch {
        res.json(null)
      }
    })

    // --- Plans (Claude only) ---
    api.get('/plans', (_req, res) => {
      try {
        const plansDir = join(homedir(), '.claude', 'plans')
        const files = readdirSync(plansDir).filter((f) => f.endsWith('.md'))
        const plans = files.map((name) => {
          const filePath = join(plansDir, name)
          const stat = statSync(filePath)
          const fd = openSync(filePath, 'r')
          const buf = Buffer.alloc(512)
          const bytesRead = readSync(fd, buf, 0, 512, 0)
          closeSync(fd)
          const head = buf.toString('utf-8', 0, bytesRead)
          const titleMatch = head.match(/^#\s+(.+)/m)
          return { name, title: titleMatch ? titleMatch[1] : name.replace('.md', ''), modifiedAt: stat.mtimeMs }
        }).sort((a, b) => b.modifiedAt - a.modifiedAt)
        res.json(plans)
      } catch {
        res.json([])
      }
    })

    api.get('/plans/:name', (req, res): void => {
      try {
        const plansDir = join(homedir(), '.claude', 'plans')
        const safeName = basename(req.params.name)
        const filePath = resolve(plansDir, safeName)
        if (!filePath.startsWith(plansDir)) { res.status(403).json({ error: 'Invalid path' }); return }
        res.json({ content: readFileSync(filePath, 'utf-8') })
      } catch {
        res.status(404).json({ error: 'Plan not found' })
      }
    })

    // --- File system ---
    api.get('/fs/directory', (req, res): void => {
      const dirPath = req.query.path as string
      if (!dirPath) { res.status(400).json({ error: 'path required' }); return }
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true })
        const filtered = entries.filter((e) =>
          e.name !== '.git' && e.name !== 'node_modules' && e.name !== '.DS_Store' && !e.name.startsWith('.')
        )
        const result = filtered.map((e) => ({
          name: e.name,
          path: join(dirPath, e.name),
          isDirectory: e.isDirectory()
        })).sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        res.json(result)
      } catch {
        res.json([])
      }
    })

    api.get('/fs/file', (req, res): void => {
      const filePath = req.query.path as string
      const maxBytes = parseInt(req.query.maxBytes as string) || 102400
      if (!filePath) { res.status(400).json({ error: 'path required' }); return }
      try {
        const stat = statSync(filePath)
        const truncated = stat.size > maxBytes
        const fd = openSync(filePath, 'r')
        const readSize = Math.min(stat.size, maxBytes)
        const buffer = Buffer.alloc(readSize)
        readSync(fd, buffer, 0, readSize, 0)
        closeSync(fd)
        const checkSize = Math.min(readSize, 8192)
        let isBinary = false
        for (let i = 0; i < checkSize; i++) {
          if (buffer[i] === 0) { isBinary = true; break }
        }
        res.json({ content: isBinary ? '' : buffer.toString('utf-8'), isBinary, truncated })
      } catch {
        res.json({ content: '', isBinary: false, truncated: false })
      }
    })
  }

  private handleWsMessage(_ws: WebSocket, msg: { type: string; id?: string; data?: string; cols?: number; rows?: number }): void {
    switch (msg.type) {
      case 'terminal:write':
        if (msg.id && msg.data !== undefined) {
          this.services.terminalService.write(msg.id, msg.data)
        }
        break
      case 'terminal:resize':
        if (msg.id && msg.cols && msg.rows) {
          this.services.terminalService.resize(msg.id, msg.cols, msg.rows)
        }
        break
      case 'get-buffer':
        if (msg.id) {
          const chunks = this.outputBuffers.get(msg.id) || []
          let data = chunks.join('')
          if (!data) {
            data = this.services.terminalService.getOutputBuffer(msg.id)
          }
          _ws.send(JSON.stringify({ type: 'terminal:buffer', id: msg.id, data }))
        }
        break
    }
  }

  private broadcast(msg: object): void {
    const data = JSON.stringify(msg)
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(data)
    }
  }

  private appendBuffer(id: string, data: string): void {
    if (!this.outputBuffers.has(id)) this.outputBuffers.set(id, [])
    const buf = this.outputBuffers.get(id)!
    buf.push(data)
    let total = buf.reduce((sum, chunk) => sum + chunk.length, 0)
    while (total > this.maxBufferSize && buf.length > 1) {
      total -= buf.shift()!.length
    }
  }

  private getLocalIp(): string {
    const ifaces = networkInterfaces()
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) return iface.address
      }
    }
    return '127.0.0.1'
  }
}
