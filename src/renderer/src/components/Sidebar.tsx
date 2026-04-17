import { useState, useEffect, useRef, useMemo } from 'react'
import { useTerminalStore, PROVIDERS, getProviderById, inferProvider } from '../stores/chatStore'
import { formatRelativeTime } from '../utils/time'
import { FileExplorer } from './FileExplorer'
import { WebRemotePanel } from './WebRemotePanel'
import { QuickProjectPicker } from './QuickProjectPicker'

function getModelShortName(modelId: string): string {
  const provider = inferProvider(modelId)
  const model = provider.models.find((m) => m.id === modelId)
  return model ? model.label : modelId
}

function getDirShortName(dir: string): string {
  return dir.split('/').pop() || dir
}

function ProviderSelector() {
  const { selectedProvider, setSelectedProvider } = useTerminalStore()
  const [open, setOpen] = useState(false)

  const current = getProviderById(selectedProvider)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-left flex items-center justify-between hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${current.color.text}`}>{current.displayName}</span>
        </div>
        <svg className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-700/50 rounded-lg overflow-hidden z-50 shadow-xl">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedProvider(p.id); setOpen(false) }}
                className={`w-full px-3 py-2 text-left hover:bg-slate-700/50 transition-colors flex items-center justify-between ${
                  selectedProvider === p.id ? 'bg-slate-700/30' : ''
                }`}
              >
                <span className={`text-xs font-medium ${p.color.text}`}>{p.displayName}</span>
                {selectedProvider === p.id && (
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ModelSelector() {
  const { selectedModel, setSelectedModel, selectedProvider } = useTerminalStore()
  const [open, setOpen] = useState(false)

  const providerConfig = getProviderById(selectedProvider)
  const models = providerConfig.models
  const current = models.find((m) => m.id === selectedModel) || models[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-left flex items-center justify-between hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-white font-medium">{current.label}</span>
          <span className="text-[11px] text-slate-500">{current.description}</span>
        </div>
        <svg className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-700/50 rounded-lg overflow-hidden z-50 shadow-xl">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => { setSelectedModel(model.id); setOpen(false) }}
                className={`w-full px-3 py-2 text-left hover:bg-slate-700/50 transition-colors flex items-center justify-between ${
                  selectedModel === model.id ? 'bg-slate-700/30' : ''
                }`}
              >
                <div>
                  <div className="text-xs text-white font-medium">{model.label}</div>
                  <div className="text-[11px] text-slate-500">{model.description}</div>
                </div>
                {selectedModel === model.id && (
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function WorktreeCleanupDialog({ branchName, onKeepBranch, onDeleteBranch }: { branchName?: string; onKeepBranch: () => void; onDeleteBranch: () => void }) {
  const displayName = branchName || 'this branch'
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[90]" onClick={onKeepBranch} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] p-6 bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl z-[91]">
        <h3 className="text-[15px] font-semibold text-white mb-3">Clean up branch?</h3>
        <p className="text-[13px] text-slate-400 mb-6 leading-relaxed">
          That was the last chat on <span className="text-white font-medium">"{displayName}"</span>. Would you also like to delete the branch and its worktree?
        </p>
        <div className="flex gap-2.5 justify-end">
          <button onClick={onKeepBranch} className="px-4 py-2 rounded-lg text-[13px] text-slate-300 bg-transparent cursor-pointer hover:bg-slate-700 transition-colors">
            Keep Branch
          </button>
          <button onClick={onDeleteBranch} className="px-4 py-2 rounded-lg text-[13px] text-white bg-red-600 cursor-pointer hover:bg-red-500 transition-colors">
            Delete Branch
          </button>
        </div>
      </div>
    </>
  )
}

function BranchCreationForm({ sourceDir, onCancel, featureId }: { sourceDir: string; onCancel: () => void; featureId?: string }) {
  const { createTerminalOnBranch, createFeatureChatOnBranch } = useTerminalStore()
  const [branchName, setBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.listGitBranches(sourceDir).then((b) => {
      setBranches(b)
    })
    window.api.gitBranch(sourceDir).then((b) => {
      if (b) setBaseBranch(b)
    })
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [sourceDir])

  const handleCreate = async () => {
    const name = branchName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      if (featureId) {
        await createFeatureChatOnBranch(featureId, name, baseBranch || undefined)
      } else {
        await createTerminalOnBranch(sourceDir, name, baseBranch || undefined)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create worktree')
      setCreating(false)
    }
  }

  return (
    <div className="px-3 py-3 border-b border-slate-700/30 bg-slate-800/40">
      <div className="text-[11px] text-slate-400 font-medium mb-2">New Chat on Branch</div>
      <input
        ref={inputRef}
        value={branchName}
        onChange={(e) => setBranchName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreate()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Branch name (e.g. feature/auth)"
        className="w-full px-3 py-2 mb-2 rounded-lg bg-slate-800 border border-slate-700/50 text-xs text-white outline-none focus:border-blue-500 transition-colors"
        disabled={creating}
      />
      <div className="mb-2">
        <div className="text-[10px] text-slate-500 mb-1">Base branch</div>
        <select
          value={baseBranch}
          onChange={(e) => setBaseBranch(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/50 text-xs text-white outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
          disabled={creating}
        >
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      {error && (
        <div className="text-[11px] text-red-400 mb-2 px-1">{error}</div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg text-[12px] text-slate-400 hover:bg-slate-700 transition-colors"
          disabled={creating}
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!branchName.trim() || creating}
          className="flex-1 py-1.5 rounded-lg text-[12px] text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
        >
          {creating ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating...
            </>
          ) : 'Create'}
        </button>
      </div>
    </div>
  )
}

function CloseFeatureDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[90]" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] p-6 bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl z-[91]">
        <h3 className="text-[15px] font-semibold text-white mb-3">Close feature?</h3>
        <p className="text-[13px] text-slate-400 mb-6 leading-relaxed">
          This will delete all chats and clean up any worktrees in <span className="text-white font-medium">"{name}"</span>.
        </p>
        <div className="flex gap-2.5 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-[13px] text-slate-300 bg-transparent cursor-pointer hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-[13px] text-white bg-red-600 cursor-pointer hover:bg-red-500 transition-colors">
            Close Feature
          </button>
        </div>
      </div>
    </>
  )
}

function FeatureCreationForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (name: string, dir: string) => void }) {
  const [name, setName] = useState('')
  const [dir, setDir] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const pickDir = async () => {
    const d = await window.api.selectDirectory()
    if (d) {
      setDir(d)
      if (!name) setName(d.split('/').pop() || '')
    }
  }

  return (
    <div className="px-3 py-3 border-b border-slate-700/30 bg-slate-800/40">
      <div className="text-[11px] text-slate-400 font-medium mb-2">New Feature</div>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim() && dir) onCreate(name.trim(), dir)
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Feature name"
        className="w-full px-3 py-2 mb-2 rounded-lg bg-slate-800 border border-slate-700/50 text-xs text-white outline-none focus:border-blue-500 transition-colors"
      />
      <button
        onClick={pickDir}
        className="w-full px-3 py-2 mb-2 rounded-lg bg-slate-800 border border-slate-700/50 text-xs text-left transition-colors hover:border-slate-600 flex items-center gap-2"
      >
        <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
        <span className={dir ? 'text-white' : 'text-slate-500'}>{dir ? getDirShortName(dir) : 'Select directory...'}</span>
      </button>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg text-[12px] text-slate-400 hover:bg-slate-700 transition-colors">Cancel</button>
        <button
          onClick={() => { if (name.trim() && dir) onCreate(name.trim(), dir) }}
          disabled={!name.trim() || !dir}
          className="flex-1 py-1.5 rounded-lg text-[12px] text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >Create</button>
      </div>
    </div>
  )
}

function ConfirmDeleteDialog({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[90]" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] p-6 bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl z-[91]">
        <h3 className="text-[15px] font-semibold text-white mb-3">Delete chat?</h3>
        <p className="text-[13px] text-slate-400 mb-6 leading-relaxed">
          Are you sure you want to delete <span className="text-white font-medium">"{title}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-2.5 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-[13px] text-slate-300 bg-transparent cursor-pointer hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-[13px] text-white bg-red-600 cursor-pointer hover:bg-red-500 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </>
  )
}

export function Sidebar() {
  const {
    terminals, activeTerminalId, connectedTerminals, unreadTerminals, typingTerminals,
    setActiveTerminal, createTerminal, forkConversation, deleteTerminal, renameTerminal,
    searchQuery, setSearchQuery, sidebarWidth, setSidebarWidth, activeSidebarView, forkingId,
    pendingWorktreeCleanup, confirmWorktreeCleanup, showBranchCreation, branchCreationDir, setShowBranchCreation,
    features, expandedFeatures, toggleFeatureExpanded, createFeature, closeFeature,
    createFeatureChat, showFeatureCreation, setShowFeatureCreation,
    featureBranchCreation, setFeatureBranchCreation, confirmCloseFeatureId, setConfirmCloseFeatureId,
    showProjectPicker, setShowProjectPicker, createTerminalInDirQuick, quickCreateFeature
  } = useTerminalStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [branches, setBranches] = useState<Record<string, string | null>>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showNewChatDropdown, setShowNewChatDropdown] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    const fetchBranches = async () => {
      const result: Record<string, string | null> = {}
      for (const t of terminals) {
        if (t.workingDirectory) {
          result[t.id] = await window.api.gitBranch(t.workingDirectory)
        }
      }
      setBranches(result)
    }
    fetchBranches()
    const interval = setInterval(fetchBranches, 5000)
    return () => clearInterval(interval)
  }, [terminals.map((t) => t.id).join(',')])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      const delta = e.clientX - resizeRef.current.startX
      setSidebarWidth(resizeRef.current.startWidth + delta)
    }
    const handleMouseUp = () => {
      resizeRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [setSidebarWidth])

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id)
    setEditTitle(currentTitle)
  }

  const finishRename = (id: string) => {
    if (editTitle.trim()) renameTerminal(id, editTitle.trim())
    setEditingId(null)
  }

  const filtered = useMemo(() => {
    if (!searchQuery) return terminals
    const q = searchQuery.toLowerCase()
    return terminals.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.workingDirectory.toLowerCase().includes(q) ||
        (branches[t.id] || '').toLowerCase().includes(q)
    )
  }, [terminals, searchQuery, branches])

  const { featureGroups, ungrouped } = useMemo(() => {
    const featureGroups: Array<{ feature: typeof features[0]; sessions: typeof filtered }> = []
    const ungrouped: typeof filtered = []

    for (const feature of features) {
      const sessions = filtered.filter((t) => t.featureId === feature.id)
      featureGroups.push({ feature, sessions })
    }
    for (const t of filtered) {
      if (!t.featureId) ungrouped.push(t)
    }
    return { featureGroups, ungrouped }
  }, [filtered, features])

  const deleteTarget = confirmDeleteId ? terminals.find((t) => t.id === confirmDeleteId) : null
  const closeFeatureTarget = confirmCloseFeatureId ? features.find((f) => f.id === confirmCloseFeatureId) : null

  const renderSessionRow = (t: typeof terminals[0]) => {
    const isActive = activeTerminalId === t.id
    const isConnected = connectedTerminals.has(t.id)
    const isUnread = unreadTerminals.has(t.id)
    const isTyping = typingTerminals.has(t.id)
    const isEditing = editingId === t.id
    const isForking = forkingId === t.id
    const branch = branches[t.id]
    const provider = getProviderById(t.provider)

    return (
      <div key={t.id} className="relative group/row">
        <button
          onClick={() => setActiveTerminal(t.id)}
          onDoubleClick={() => startRename(t.id, t.title)}
          className={`w-full text-left rounded-lg px-3 py-2.5 mb-0.5 transition-all cursor-pointer ${
            isActive
              ? 'bg-slate-800 shadow-sm'
              : 'hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-0.5">
            {/* Status indicator */}
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isTyping ? 'bg-yellow-400 animate-pulse' :
              isUnread ? 'bg-blue-400' :
              isConnected ? 'bg-emerald-400' :
              'bg-slate-600'
            }`} />

            {isEditing ? (
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => finishRename(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishRename(t.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 bg-slate-700 text-xs text-white rounded px-1 py-0.5 outline-none border border-blue-500 min-w-0"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                {t.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 pl-3.5">
            {/* Provider badge */}
            <span className={`text-[10px] px-1 py-0.5 rounded ${provider.color.text} ${provider.color.bg}`}>
              {getModelShortName(t.model)}
            </span>

            {/* Branch */}
            {branch && (
              <span className={`text-[10px] px-1 py-0.5 rounded flex items-center gap-0.5 ${
                t.worktreePath ? 'bg-emerald-400/10 text-emerald-400/80' : 'bg-slate-800 text-slate-500'
              }`}>
                <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.564a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.25 8.81" />
                </svg>
                {branch}
              </span>
            )}

            {/* Directory */}
            <span className="text-[10px] text-slate-600 truncate">{getDirShortName(t.workingDirectory)}</span>

            {/* Time */}
            <span className="text-[10px] text-slate-600 ml-auto shrink-0">{formatRelativeTime(t.updatedAt)}</span>
          </div>
        </button>

        {/* Action buttons on hover */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
          {isForking ? (
            <div className="w-5 h-5 flex items-center justify-center">
              <svg className="w-3 h-3 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); forkConversation(t.id) }}
                className="w-5 h-5 rounded text-slate-500 hover:text-purple-400 hover:bg-purple-400/10 flex items-center justify-center"
                title="Fork conversation"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(t.id) }}
                className="w-5 h-5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center"
                title="Delete chat"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {confirmDeleteId && deleteTarget && (
        <ConfirmDeleteDialog
          title={deleteTarget.title}
          onConfirm={() => { deleteTerminal(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {pendingWorktreeCleanup && (
        <WorktreeCleanupDialog
          branchName={pendingWorktreeCleanup.branchName}
          onKeepBranch={() => confirmWorktreeCleanup(false)}
          onDeleteBranch={() => confirmWorktreeCleanup(true)}
        />
      )}

      {closeFeatureTarget && (
        <CloseFeatureDialog
          name={closeFeatureTarget.name}
          onConfirm={() => closeFeature(closeFeatureTarget.id)}
          onCancel={() => setConfirmCloseFeatureId(null)}
        />
      )}

      <div className="bg-slate-900 border-r border-slate-700/50 flex flex-col h-full shrink-0 relative" style={{ width: sidebarWidth }}>
        {/* Resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10"
          onMouseDown={(e) => {
            resizeRef.current = { startX: e.clientX, startWidth: sidebarWidth }
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
        />

        {/* Traffic light spacer */}
        <div className="h-12 shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

        {activeSidebarView === 'remote' ? (
          <WebRemotePanel />
        ) : activeSidebarView === 'files' ? (
          <FileExplorer />
        ) : (
          <>
            {/* Header */}
            <div className="px-3 pb-5 border-b border-slate-700/30">
              {/* App title */}
              <div className="flex items-center gap-2 mb-5 pl-0.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3" />
                  </svg>
                </div>
                <h1 className="text-base font-semibold text-white tracking-tight">Claude</h1>
              </div>

              {/* Search */}
              <div className="flex items-center gap-3 px-4 py-3 mb-5 rounded-lg bg-slate-800/50 border border-slate-700/30">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
                  <circle cx="6" cy="6" r="4.5" />
                  <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="flex-1 bg-transparent text-xs text-white outline-none min-w-0 border-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-slate-500 hover:text-slate-300 shrink-0"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Provider selector row */}
              <div className="mb-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1.5 pl-0.5">Default agent</div>
                <ProviderSelector />
              </div>

              {/* Model selector row */}
              <div className="mb-5">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1.5 pl-0.5">Default model</div>
                <ModelSelector />
              </div>

              {/* New Chat split button */}
              <div className="relative flex">
                <button
                  onClick={createTerminal}
                  className="flex-1 py-3 rounded-l-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  title="New Chat (⌘N)"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New Chat
                </button>
                <button
                  onClick={() => setShowNewChatDropdown(!showNewChatDropdown)}
                  className="px-2 py-3 rounded-r-lg bg-blue-600 hover:bg-blue-500 text-white border-l border-blue-500/50 transition-colors"
                  title="More options"
                >
                  <svg className={`w-3 h-3 transition-transform ${showNewChatDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showNewChatDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNewChatDropdown(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700/50 rounded-lg overflow-hidden z-50 shadow-xl">
                      <button
                        onClick={() => {
                          setShowNewChatDropdown(false)
                          createTerminal()
                        }}
                        className="w-full px-3 py-2.5 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <div>
                          <div className="text-xs text-white font-medium">New Chat</div>
                          <div className="text-[10px] text-slate-500">Select a directory</div>
                        </div>
                      </button>
                      <button
                        onClick={async () => {
                          setShowNewChatDropdown(false)
                          // Use active terminal's directory or ask for one
                          const activeTerminal = terminals.find((t) => t.id === activeTerminalId)
                          const dir = activeTerminal ? (activeTerminal.sourceDirectory || activeTerminal.workingDirectory) : await window.api.selectDirectory()
                          if (dir) setShowBranchCreation(true, dir)
                        }}
                        className="w-full px-3 py-2.5 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.564a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.25 8.81" />
                        </svg>
                        <div>
                          <div className="text-xs text-white font-medium">New Chat on Branch</div>
                          <div className="text-[10px] text-slate-500">Work in parallel on a new branch</div>
                        </div>
                      </button>
                      <div className="border-t border-slate-700/30" />
                      <button
                        onClick={() => {
                          setShowNewChatDropdown(false)
                          quickCreateFeature()
                        }}
                        className="w-full px-3 py-2.5 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                        <div>
                          <div className="text-xs text-white font-medium">New Feature</div>
                          <div className="text-[10px] text-slate-500">Same repo, one click</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Quick Project Picker */}
              {showProjectPicker && (
                <QuickProjectPicker
                  onSelect={(dir) => createTerminalInDirQuick(dir)}
                  onCancel={() => setShowProjectPicker(false)}
                />
              )}
            </div>

            {/* Feature creation form */}
            {showFeatureCreation && (
              <FeatureCreationForm
                onCancel={() => setShowFeatureCreation(false)}
                onCreate={(name, dir) => createFeature(name, dir)}
              />
            )}

            {/* Branch creation form */}
            {showBranchCreation && branchCreationDir && (
              <BranchCreationForm
                sourceDir={branchCreationDir}
                onCancel={() => setShowBranchCreation(false)}
              />
            )}

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto px-3 py-1.5">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center">
                  {searchQuery ? (
                    <p className="text-[11px] text-slate-500">No matching chats</p>
                  ) : (
                    <>
                      <svg className="w-8 h-8 mx-auto text-slate-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                      <p className="text-[11px] text-slate-500">No chats yet</p>
                    </>
                  )}
                </div>
              )}

              {/* Feature groups */}
              {featureGroups.map(({ feature, sessions }) => {
                const isExpanded = expandedFeatures.has(feature.id)
                return (
                  <div key={feature.id} className="mb-1">
                    {/* Feature header */}
                    <div className="group/fh flex items-center gap-1.5 py-1.5 pr-1">
                      <button
                        onClick={() => toggleFeatureExpanded(feature.id)}
                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left hover:bg-slate-800/30 rounded px-1 py-0.5 transition-colors"
                      >
                        <svg className={`w-2.5 h-2.5 text-slate-500 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                        <span className="text-[12px] text-slate-200 font-semibold truncate">{feature.name}</span>
                        <span className="text-[10px] text-slate-600 shrink-0 ml-auto">{sessions.length}</span>
                      </button>
                      <div className="flex gap-0.5 opacity-0 group-hover/fh:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => createFeatureChat(feature.id)}
                          className="w-5 h-5 rounded text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 flex items-center justify-center"
                          title="New chat"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setFeatureBranchCreation({ featureId: feature.id, directory: feature.directory })}
                          className="w-5 h-5 rounded text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10 flex items-center justify-center"
                          title="New chat on branch"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.564a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.25 8.81" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmCloseFeatureId(feature.id)}
                          className="w-5 h-5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center"
                          title="Close feature"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Branch creation form for this feature */}
                    {featureBranchCreation?.featureId === feature.id && (
                      <BranchCreationForm
                        sourceDir={featureBranchCreation.directory}
                        onCancel={() => setFeatureBranchCreation(null)}
                        featureId={feature.id}
                      />
                    )}

                    {/* Sessions */}
                    {isExpanded && sessions.map((t) => renderSessionRow(t))}
                    {isExpanded && sessions.length === 0 && (
                      <div className="px-4 py-2 text-[11px] text-slate-600 italic">No chats yet</div>
                    )}
                  </div>
                )
              })}

              {/* Ungrouped sessions */}
              {ungrouped.length > 0 && (
                <div className="mb-1">
                  {featureGroups.length > 0 && (
                    <div className="py-1.5 px-1">
                      <span className="text-[10px] text-slate-600 uppercase tracking-wider font-medium">Ungrouped</span>
                    </div>
                  )}
                  {ungrouped.map((t) => renderSessionRow(t))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-slate-700/30 flex items-center gap-3">
              <div className="flex items-center gap-1">
                <kbd className="text-[9px] text-slate-500 bg-slate-800/80 px-1 py-0.5 rounded font-mono">⌘K</kbd>
                <span className="text-[9px] text-slate-600">Commands</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="text-[9px] text-slate-500 bg-slate-800/80 px-1 py-0.5 rounded font-mono">⌘N</kbd>
                <span className="text-[9px] text-slate-600">New</span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
