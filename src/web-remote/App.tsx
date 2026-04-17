import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { api, hasToken, setToken, connectWs, disconnectWs, wsWrite, wsGetBuffer, wsResize, isWsConnected } from './api'
import { useRemoteStore } from './store'
import type { TerminalSession } from './api'

// --- Login Screen ---
function LoginScreen() {
  const [tokenInput, setTokenInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tokenInput.trim()) {
      setToken(tokenInput.trim())
      window.location.reload()
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Claudia</h1>
        </div>
        <p className="text-sm text-slate-400 text-center mb-6">
          Enter the connection token from your desktop app, or scan the QR code.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste token here..."
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white outline-none focus:border-cyan-500 mb-4"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition-colors"
          >
            Connect
          </button>
        </form>
      </div>
    </div>
  )
}

// --- Conversation History (fallback when no terminal buffer) ---
function ConversationHistory({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    api.getHistory(sessionId).then((msgs) => {
      setMessages(msgs)
      setLoading(false)
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
      })
    }).catch(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading conversation...</div>
      </div>
    )
  }

  if (messages.length === 0) return null

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-3 py-4 space-y-3">
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
            msg.role === 'user'
              ? 'bg-cyan-600/20 text-cyan-100 rounded-br-md'
              : 'bg-slate-800 text-slate-200 rounded-bl-md'
          }`}>
            {msg.role === 'assistant' && (
              <div className="text-[10px] text-purple-400 font-medium mb-1">Claude</div>
            )}
            {msg.text.length > 2000 ? msg.text.slice(0, 2000) + '...' : msg.text}
          </div>
        </div>
      ))}
      <div className="text-center text-[10px] text-slate-600 py-2">
        Terminal output will appear below when Claude responds
      </div>
    </div>
  )
}

// --- Terminal View ---
const terminals = new Map<string, { term: Terminal; fitAddon: FitAddon; hasContent: boolean }>()

function TerminalView({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !sessionId) return

    let entry = terminals.get(sessionId)
    if (!entry) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const term = new Terminal({
        theme: {
          background: '#0f172a',
          foreground: '#e2e8f0',
          cursor: '#e2e8f0',
          selectionBackground: '#334155',
          black: '#1e293b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#f1f5f9'
        },
        fontSize: isMobile ? 11 : 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        lineHeight: 1.3,
        scrollback: 5000,
        cursorBlink: false,
        convertEol: true,
        disableStdin: true,
        allowProposedApi: true
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      entry = { term, fitAddon, hasContent: false }
      terminals.set(sessionId, entry)

      term.open(containerRef.current)

      // Delay fit to ensure container has final dimensions
      requestAnimationFrame(() => {
        fitAddon.fit()
        wsResize(sessionId, term.cols, term.rows)
        // Load buffer via REST (more reliable for checking if content exists)
        api.getBuffer(sessionId).then(({ data }) => {
          if (data) {
            term.write(data)
            term.scrollToBottom()
            const e = terminals.get(sessionId)
            if (e) e.hasContent = true
            setShowHistory(false)
          } else {
            // No terminal buffer — show conversation history
            setShowHistory(true)
          }
        }).catch(() => {
          setShowHistory(true)
        })
      })
    } else {
      // Re-attach existing terminal
      const el = containerRef.current
      if (el.children.length === 0) {
        entry.term.open(el)
      }
      entry.fitAddon.fit()
      setShowHistory(!entry.hasContent)
    }

    const handleResize = () => {
      const e = terminals.get(sessionId)
      if (e) {
        e.fitAddon.fit()
        wsResize(sessionId, e.term.cols, e.term.rows)
      }
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [sessionId])

  // When new terminal data arrives, hide history and show terminal
  useEffect(() => {
    if (!showHistory) return
    const checkContent = () => {
      const e = terminals.get(sessionId)
      if (e && e.hasContent) setShowHistory(false)
    }
    const interval = setInterval(checkContent, 500)
    return () => clearInterval(interval)
  }, [sessionId, showHistory])

  return (
    <div className="w-full h-full relative">
      {showHistory && (
        <div className="absolute inset-0 z-10 bg-[#0f172a]">
          <ConversationHistory sessionId={sessionId} />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}

// Helper to scroll terminal to bottom
function scrollTerminalToBottom(sessionId: string) {
  const entry = terminals.get(sessionId)
  if (entry) entry.term.scrollToBottom()
}

// Helper to clear terminal display
function clearTerminal(sessionId: string) {
  const entry = terminals.get(sessionId)
  if (entry) {
    entry.term.clear()
    entry.term.scrollToBottom()
  }
}

// --- Plan Viewer ---
function PlanViewer() {
  const { setShowPlans } = useRemoteStore()
  const [plans, setPlans] = useState<{ name: string; title: string; modifiedAt: number }[]>([])
  const [selectedPlan, setSelectedPlan] = useState<{ name: string; content: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listPlans().then((list) => {
      setPlans(list)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const openPlan = async (name: string) => {
    const result = await api.readPlan(name)
    if (result?.content) {
      setSelectedPlan({ name, content: result.content })
    }
  }

  const formatTime = (ms: number) => {
    const diff = Date.now() - ms
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  // Render plan content with basic markdown formatting
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold text-slate-100 mb-3 pb-2 border-b border-slate-800">{line.slice(2)}</h1>
      if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold text-slate-200 mt-4 mb-2">{line.slice(3)}</h2>
      if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-slate-300 mt-3 mb-1">{line.slice(4)}</h3>
      if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-[13px] text-slate-300 leading-relaxed list-disc">{line.slice(2)}</li>
      if (line.startsWith('```')) return <hr key={i} className="border-slate-800 my-2" />
      if (line.trim() === '') return <div key={i} className="h-2" />
      return <p key={i} className="text-[13px] text-slate-300 leading-relaxed">{line}</p>
    })
  }

  if (selectedPlan) {
    return (
      <div className="h-full flex flex-col bg-[#0f172a]">
        <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-900 border-b border-slate-700/50 shrink-0">
          <button
            onClick={() => setSelectedPlan(null)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-medium text-white truncate">{selectedPlan.name}</h1>
          </div>
          <button
            onClick={() => setShowPlans(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {renderContent(selectedPlan.content)}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#0f172a]">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-900 border-b border-slate-700/50 shrink-0">
        <button
          onClick={() => setShowPlans(false)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-sm font-medium text-white">Plans</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-slate-500">Loading plans...</span>
          </div>
        ) : plans.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-slate-500">No plans found</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {plans.map((plan) => (
              <button
                key={plan.name}
                onClick={() => openPlan(plan.name)}
                className="w-full px-4 py-3.5 text-left active:bg-slate-800/50 transition-colors"
              >
                <div className="text-sm text-slate-200 font-medium truncate">{plan.title}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {plan.name} &middot; {formatTime(plan.modifiedAt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Session Drawer ---
function SessionDrawer() {
  const { sessions, activeSessionId, setActiveSession, removeSession, setDrawerOpen } = useRemoteStore()
  const [newChatDir, setNewChatDir] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)

  const handleCreate = async () => {
    if (!newChatDir.trim()) return
    const session = await api.createTerminal(newChatDir.trim())
    useRemoteStore.getState().addSession(session)
    setShowNewChat(false)
    setNewChatDir('')
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await api.deleteTerminal(id)
    removeSession(id)
    terminals.delete(id)
  }

  const handleReconnect = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await api.reconnectTerminal(id)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed left-0 top-0 bottom-0 w-72 bg-slate-900 border-r border-slate-700/50 z-50 flex flex-col animate-slide-in">
        {/* Drawer header */}
        <div className="p-4 border-b border-slate-700/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white">Sessions</h2>
          </div>

          <button
            onClick={() => setShowNewChat(!showNewChat)}
            className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chat
          </button>

          {showNewChat && (
            <div className="mt-3">
              <input
                type="text"
                value={newChatDir}
                onChange={(e) => setNewChatDir(e.target.value)}
                placeholder="Working directory path..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-cyan-500 mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-medium"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowNewChat(false); setNewChatDir('') }}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 && (
            <p className="text-center text-xs text-slate-500 py-8">No sessions yet</p>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSession(s.id)}
              className={`mb-1 px-3 py-2.5 rounded-lg cursor-pointer transition-colors flex items-start gap-2 ${
                activeSessionId === s.id ? 'bg-slate-700/60' : 'hover:bg-slate-800/50'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-1.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200 truncate">{s.title}</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  {s.workingDirectory.split('/').pop()}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    s.model.includes('opus') ? 'text-purple-400 bg-purple-400/10' :
                    s.model.includes('haiku') ? 'text-green-400 bg-green-400/10' :
                    'text-blue-400 bg-blue-400/10'
                  }`}>
                    {s.model.includes('opus') ? 'Opus' : s.model.includes('haiku') ? 'Haiku' : 'Sonnet'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={(e) => handleReconnect(e, s.id)}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:bg-cyan-400/10"
                  title="Reconnect"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                </button>
                <button
                  onClick={(e) => handleDelete(e, s.id)}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                  title="Delete"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// --- Input Bar ---
function InputBar({ sessionId }: { sessionId: string }) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const send = useCallback(() => {
    if (!input.trim() && !input) return
    // Use bracketed paste for multi-line, simple write for single line
    if (input.includes('\n')) {
      wsWrite(sessionId, `\x1b[200~${input}\x1b[201~`)
      setTimeout(() => wsWrite(sessionId, '\r'), 50)
    } else {
      wsWrite(sessionId, input + '\r')
    }
    setInput('')
    inputRef.current?.focus()
  }, [input, sessionId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Send special keys
  const sendCtrlC = () => wsWrite(sessionId, '\x03')
  const sendEscape = () => wsWrite(sessionId, '\x1b')

  return (
    <div className="border-t border-slate-700/50 bg-slate-900 p-3 pb-[env(safe-area-inset-bottom,12px)]">
      {/* Claude Code action buttons */}
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar">
        {/* Edit prompt actions */}
        <button
          onClick={() => wsWrite(sessionId, '\r')}
          className="px-3 py-1.5 rounded-lg bg-green-600/20 border border-green-500/30 text-[11px] text-green-400 font-semibold active:bg-green-600/40 transition-colors shrink-0"
        >
          Accept
        </button>
        <button
          onClick={() => wsWrite(sessionId, '\x1b[Z')}
          className="px-3 py-1.5 rounded-lg bg-green-600/10 border border-green-500/20 text-[11px] text-green-300 font-semibold active:bg-green-600/30 transition-colors shrink-0"
        >
          Accept All
        </button>
        <button
          onClick={sendEscape}
          className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-[11px] text-red-400 font-semibold active:bg-red-500/30 transition-colors shrink-0"
        >
          Reject
        </button>
        <button
          onClick={() => wsWrite(sessionId, '\t')}
          className="px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-[11px] text-blue-400 font-semibold active:bg-blue-500/30 transition-colors shrink-0"
        >
          Amend
        </button>
        <div className="w-px h-4 bg-slate-700/50 mx-0.5 shrink-0" />
        {/* Utility keys */}
        <button
          onClick={sendCtrlC}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700/50 text-[10px] text-red-400 font-mono font-medium active:bg-slate-700 transition-colors shrink-0"
        >
          Ctrl+C
        </button>
        <button
          onClick={() => wsWrite(sessionId, '\x1b[A')}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700/50 text-[10px] text-slate-400 font-mono font-medium active:bg-slate-700 transition-colors shrink-0"
        >
          Up
        </button>
        <button
          onClick={() => wsWrite(sessionId, '\x1b[B')}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700/50 text-[10px] text-slate-400 font-mono font-medium active:bg-slate-700 transition-colors shrink-0"
        >
          Down
        </button>
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700/50 text-sm text-white outline-none resize-none focus:border-cyan-500/50 max-h-32"
          style={{ minHeight: '40px' }}
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="shrink-0 w-10 h-10 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// --- Main App ---
function MainApp() {
  const { sessions, activeSessionId, setActiveSession, setSessions, updateTitle, setConnected, connected, drawerOpen, setDrawerOpen, showPlans, setShowPlans } = useRemoteStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  // Load sessions and connect WebSocket
  useEffect(() => {
    api.listTerminals().then((list) => {
      setSessions(list)
      if (list.length > 0 && !activeSessionId) {
        setActiveSession(list[0].id)
      }
    })

    connectWs({
      onData: (id, data) => {
        const entry = terminals.get(id)
        if (entry) {
          entry.term.write(data)
          entry.term.scrollToBottom()
          entry.hasContent = true
        }
      },
      onExit: (_id) => {
        // Terminal exited — could show reconnect prompt
      },
      onTitleUpdate: (id, title) => {
        updateTitle(id, title)
      },
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false)
    })

    return () => disconnectWs()
  }, [])

  return (
    <div className="h-full flex flex-col bg-[#0f172a]">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-900 border-b border-slate-700/50 shrink-0">
        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium text-white truncate">
            {activeSession?.title || 'Claudia Remote'}
          </h1>
          {activeSession && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-500 truncate">
                {activeSession.workingDirectory.split('/').pop()}
              </span>
              <span className={`text-[10px] font-medium px-1 rounded ${
                activeSession.model.includes('opus') ? 'text-purple-400 bg-purple-400/10' :
                activeSession.model.includes('haiku') ? 'text-green-400 bg-green-400/10' :
                'text-blue-400 bg-blue-400/10'
              }`}>
                {activeSession.model.includes('opus') ? 'Opus' : activeSession.model.includes('haiku') ? 'Haiku' : 'Sonnet'}
              </span>
            </div>
          )}
        </div>

        {/* Plans + Connection indicator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPlans(!showPlans)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              showPlans ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </button>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
        </div>
      </div>

      {/* Plan viewer overlay */}
      {showPlans && (
        <div className="flex-1 min-h-0">
          <PlanViewer />
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 min-h-0 relative" style={{ display: showPlans ? 'none' : undefined }}>
        {!activeSession ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center px-6">
              <svg className="w-12 h-12 mx-auto text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <p className="text-sm text-slate-500 mb-4">No active session</p>
              <button
                onClick={() => setDrawerOpen(true)}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium"
              >
                Open Sessions
              </button>
            </div>
          </div>
        ) : (
          <>
            {sessions.map((s) => (
              <div
                key={s.id}
                className="absolute inset-0"
                style={{ display: activeSessionId === s.id ? 'block' : 'none' }}
              >
                <TerminalView sessionId={s.id} />
              </div>
            ))}
            {/* Floating action buttons */}
            <div className="absolute right-2 bottom-2 flex flex-col gap-2 z-10">
              <button
                onClick={() => clearTerminal(activeSessionId!)}
                className="w-9 h-9 rounded-full bg-slate-800/90 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white active:bg-slate-700 backdrop-blur-sm"
                title="Clear screen"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={() => scrollTerminalToBottom(activeSessionId!)}
                className="w-9 h-9 rounded-full bg-slate-800/90 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white active:bg-slate-700 backdrop-blur-sm"
                title="Scroll to bottom"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Input bar */}
      {activeSession && !showPlans && <InputBar sessionId={activeSession.id} />}

      {/* Session drawer */}
      {drawerOpen && <SessionDrawer />}
    </div>
  )
}

// --- Root ---
export default function App() {
  if (!hasToken()) return <LoginScreen />
  return <MainApp />
}
