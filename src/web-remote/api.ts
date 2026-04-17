export interface TerminalSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  workingDirectory: string
  model: string
  sessionId: string
}

// Extract token from URL params or localStorage
function getToken(): string {
  const params = new URLSearchParams(window.location.search)
  const urlToken = params.get('token')
  if (urlToken) {
    localStorage.setItem('claudia-token', urlToken)
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname)
    return urlToken
  }
  return localStorage.getItem('claudia-token') || ''
}

const BASE_URL = `${window.location.protocol}//${window.location.host}`
let token = getToken()

export function hasToken(): boolean {
  return token.length > 0
}

export function setToken(t: string): void {
  token = t
  localStorage.setItem('claudia-token', t)
}

export function clearToken(): void {
  token = ''
  localStorage.removeItem('claudia-token')
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })
  if (res.status === 401) {
    clearToken()
    window.location.reload()
    throw new Error('Unauthorized')
  }
  return res.json()
}

// REST API
export const api = {
  listTerminals: () => apiFetch<TerminalSession[]>('/terminals'),

  createTerminal: (workingDirectory: string, model?: string) =>
    apiFetch<TerminalSession>('/terminals', {
      method: 'POST',
      body: JSON.stringify({ workingDirectory, model })
    }),

  deleteTerminal: (id: string) =>
    apiFetch('/terminals/' + id, { method: 'DELETE' }),

  renameTerminal: (id: string, title: string) =>
    apiFetch('/terminals/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ title })
    }),

  reconnectTerminal: (id: string) =>
    apiFetch('/terminals/' + id + '/reconnect', { method: 'POST' }),

  resizeTerminal: (id: string, cols: number, rows: number) =>
    apiFetch('/terminals/' + id + '/resize', {
      method: 'POST',
      body: JSON.stringify({ cols, rows })
    }),

  getBuffer: (id: string) =>
    apiFetch<{ data: string }>('/terminals/' + id + '/buffer'),

  getContextUsage: (sessionId: string, cwd: string) =>
    apiFetch<{ contextUsed: number; outputTokens: number; model: string | null } | null>(
      `/context-usage?sessionId=${encodeURIComponent(sessionId)}&cwd=${encodeURIComponent(cwd)}`
    ),

  getHistory: (id: string) =>
    apiFetch<{ role: string; text: string }[]>('/terminals/' + id + '/history'),

  gitBranch: (cwd: string) =>
    apiFetch<{ branch: string | null }>(`/git/branch?cwd=${encodeURIComponent(cwd)}`),

  listPlans: () =>
    apiFetch<{ name: string; title: string; modifiedAt: number }[]>('/plans'),

  readPlan: (name: string) =>
    apiFetch<{ content: string }>('/plans/' + encodeURIComponent(name))
}

// WebSocket
export type WsHandler = {
  onData: (id: string, data: string) => void
  onExit: (id: string) => void
  onTitleUpdate: (id: string, title: string) => void
  onConnect: () => void
  onDisconnect: () => void
}

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export function connectWs(handler: WsHandler): void {
  if (ws) return

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws?token=${token}`
  ws = new WebSocket(wsUrl)

  ws.onopen = () => handler.onConnect()

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'terminal:data':
          handler.onData(msg.id, msg.data)
          break
        case 'terminal:exit':
          handler.onExit(msg.id)
          break
        case 'terminal:title-updated':
          handler.onTitleUpdate(msg.id, msg.title)
          break
        case 'terminal:buffer':
          handler.onData(msg.id, msg.data)
          break
      }
    } catch { /* ignore */ }
  }

  ws.onclose = () => {
    ws = null
    handler.onDisconnect()
    // Auto-reconnect
    reconnectTimer = setTimeout(() => connectWs(handler), 2000)
  }

  ws.onerror = () => ws?.close()
}

export function disconnectWs(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  ws?.close()
  ws = null
}

export function wsWrite(id: string, data: string): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'terminal:write', id, data }))
  }
}

export function wsResize(id: string, cols: number, rows: number): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'terminal:resize', id, cols, rows }))
  }
}

export function wsGetBuffer(id: string): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'get-buffer', id }))
  }
}

export function isWsConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN
}
