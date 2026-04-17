import { useState, useEffect, useCallback } from 'react'
import { useTerminalStore } from '../stores/chatStore'

interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
}

function getFileIconColor(name: string): string {
  if (/\.(ts|tsx|js|jsx)$/.test(name)) return 'text-blue-400'
  if (/\.(json|yaml|yml|toml)$/.test(name)) return 'text-yellow-400'
  if (/\.(md|mdx)$/.test(name)) return 'text-slate-300'
  if (/\.(css|scss|less)$/.test(name)) return 'text-purple-400'
  if (/\.(html|htm)$/.test(name)) return 'text-orange-400'
  return 'text-slate-500'
}

function FileIcon({ name }: { name: string }) {
  const color = getFileIconColor(name)
  return (
    <svg className={`w-4 h-4 ${color} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function FolderIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function TreeNode({
  entry,
  depth,
  childrenCache,
  loadDir,
  rootDir
}: {
  entry: DirEntry
  depth: number
  childrenCache: Map<string, DirEntry[]>
  loadDir: (path: string) => void
  rootDir: string
}) {
  const { expandedDirs, toggleDirExpanded } = useTerminalStore()
  const isExpanded = expandedDirs.has(entry.path)
  const children = childrenCache.get(entry.path)

  const handleClick = () => {
    if (entry.isDirectory) {
      toggleDirExpanded(entry.path)
      if (!isExpanded && !children) {
        loadDir(entry.path)
      }
    } else {
      // Preview file in-app
      useTerminalStore.getState().setPreviewFile(entry.path)
    }
  }

  return (
    <>
      <div
        onClick={handleClick}
        className="flex items-center gap-1.5 py-[3px] cursor-pointer hover:bg-slate-800/50 transition-colors group"
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        {entry.isDirectory && (
          <svg
            className={`w-2.5 h-2.5 text-slate-500 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
        {!entry.isDirectory && <div className="w-2.5 shrink-0" />}
        {entry.isDirectory ? <FolderIcon open={isExpanded} /> : <FileIcon name={entry.name} />}
        <span className={`text-xs truncate ${entry.isDirectory ? 'text-slate-200 font-medium' : 'text-slate-300'}`}>
          {entry.name}
        </span>
      </div>
      {entry.isDirectory && isExpanded && children && children.map((child) => (
        <TreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          childrenCache={childrenCache}
          loadDir={loadDir}
          rootDir={rootDir}
        />
      ))}
    </>
  )
}

export function FileExplorer() {
  const { terminals, activeTerminalId, expandedDirs } = useTerminalStore()
  const [childrenCache, setChildrenCache] = useState<Map<string, DirEntry[]>>(new Map())
  const [rootEntries, setRootEntries] = useState<DirEntry[]>([])

  const activeTerminal = terminals.find((t) => t.id === activeTerminalId)
  const rootDir = activeTerminal?.workingDirectory || null
  const projectName = rootDir ? rootDir.split('/').pop() || rootDir : null

  const loadDir = useCallback(async (dirPath: string) => {
    const entries = await window.api.readDirectory(dirPath)
    setChildrenCache((prev) => {
      const next = new Map(prev)
      next.set(dirPath, entries)
      return next
    })
  }, [])

  // Load root directory when it changes
  useEffect(() => {
    if (!rootDir) {
      setRootEntries([])
      setChildrenCache(new Map())
      return
    }
    window.api.readDirectory(rootDir).then(setRootEntries)
  }, [rootDir])

  // Load children for any newly expanded directory
  useEffect(() => {
    for (const dir of expandedDirs) {
      if (!childrenCache.has(dir)) {
        loadDir(dir)
      }
    }
  }, [expandedDirs, childrenCache, loadDir])

  const refresh = () => {
    if (!rootDir) return
    setChildrenCache(new Map())
    window.api.readDirectory(rootDir).then(setRootEntries)
  }

  const collapseAll = () => {
    useTerminalStore.setState({ expandedDirs: new Set() })
  }

  if (!rootDir) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="px-3 py-3 border-b border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Explorer</div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-[11px] text-slate-500 text-center">Select a chat to browse its project files</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-700/30 flex items-center justify-between shrink-0">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium truncate">{projectName}</div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={collapseAll}
            className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Collapse All"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          </button>
          <button
            onClick={refresh}
            className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {rootEntries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            childrenCache={childrenCache}
            loadDir={loadDir}
            rootDir={rootDir}
          />
        ))}
      </div>
    </div>
  )
}
