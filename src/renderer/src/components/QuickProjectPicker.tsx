import { useState, useEffect, useRef, useCallback } from 'react'

interface PinnedProject {
  id: string
  directory: string
  name: string
  createdAt: number
}

interface QuickProjectPickerProps {
  onSelect: (directory: string) => void
  onCancel: () => void
}

function getDirName(dir: string): string {
  return dir.split('/').pop() || dir
}

function shortenPath(dir: string): string {
  const home = '/Users/'
  if (dir.startsWith(home)) {
    const parts = dir.substring(home.length).split('/')
    if (parts.length > 0) {
      return '~/' + parts.slice(1).join('/')
    }
  }
  return dir
}

export function QuickProjectPicker({ onSelect, onCancel }: QuickProjectPickerProps) {
  const [pinned, setPinned] = useState<PinnedProject[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadProjects = useCallback(async () => {
    const [pinnedList, recentList] = await Promise.all([
      window.api.listPinnedProjects(),
      window.api.listRecentProjects(10)
    ])
    setPinned(pinnedList)
    // Filter recent to exclude pinned directories
    const pinnedDirs = new Set(pinnedList.map((p: PinnedProject) => p.directory))
    setRecent(recentList.filter((d: string) => !pinnedDirs.has(d)))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Total items: pinned + recent + browse button
  const totalItems = pinned.length + recent.length + 1

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleSelect(selectedIndex)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, totalItems, pinned, recent])

  // Auto-focus
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const handleSelect = async (index: number) => {
    if (index < pinned.length) {
      onSelect(pinned[index].directory)
    } else if (index < pinned.length + recent.length) {
      onSelect(recent[index - pinned.length])
    } else {
      // Browse button
      const dir = await window.api.selectDirectory()
      if (dir) onSelect(dir)
      else onCancel()
    }
  }

  const togglePin = async (directory: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const existingPin = pinned.find((p) => p.directory === directory)
    if (existingPin) {
      await window.api.unpinProject(existingPin.id)
    } else {
      await window.api.pinProject(directory)
    }
    await loadProjects()
  }

  const unpinById = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.api.unpinProject(id)
    await loadProjects()
  }

  if (loading) return null

  let itemIndex = 0

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onCancel} />

      {/* Picker dropdown */}
      <div
        ref={containerRef}
        tabIndex={-1}
        className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700/50 rounded-lg overflow-hidden z-50 shadow-xl max-h-[400px] overflow-y-auto outline-none"
      >
        {/* Pinned section */}
        {pinned.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-medium border-b border-slate-700/30 bg-slate-800/80 sticky top-0">
              ⭐ Pinned
            </div>
            {pinned.map((p) => {
              const idx = itemIndex++
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full px-3 py-2.5 text-left flex items-center gap-2.5 transition-colors group/item ${
                    selectedIndex === idx ? 'bg-blue-600/20' : 'hover:bg-slate-700/50'
                  }`}
                >
                  {/* Folder icon */}
                  <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{shortenPath(p.directory)}</div>
                  </div>
                  {/* Unpin button */}
                  <button
                    onClick={(e) => unpinById(p.id, e)}
                    className="w-5 h-5 rounded shrink-0 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"
                    title="Unpin"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                </button>
              )
            })}
          </>
        )}

        {/* Recent section */}
        {recent.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-medium border-b border-slate-700/30 bg-slate-800/80 sticky top-0">
              Recent
            </div>
            {recent.map((dir) => {
              const idx = itemIndex++
              return (
                <button
                  key={dir}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full px-3 py-2.5 text-left flex items-center gap-2.5 transition-colors group/item ${
                    selectedIndex === idx ? 'bg-blue-600/20' : 'hover:bg-slate-700/50'
                  }`}
                >
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-medium truncate">{getDirName(dir)}</div>
                    <div className="text-[10px] text-slate-500 truncate">{shortenPath(dir)}</div>
                  </div>
                  {/* Pin button */}
                  <button
                    onClick={(e) => togglePin(dir, e)}
                    className="w-5 h-5 rounded shrink-0 text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"
                    title="Pin project"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                </button>
              )
            })}
          </>
        )}

        {/* Empty state */}
        {pinned.length === 0 && recent.length === 0 && (
          <div className="px-4 py-6 text-center">
            <svg className="w-8 h-8 mx-auto text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <p className="text-[11px] text-slate-500">No recent projects yet</p>
            <p className="text-[10px] text-slate-600 mt-1">Browse to select a directory</p>
          </div>
        )}

        {/* Browse button */}
        <div className="border-t border-slate-700/30">
          {(() => {
            const idx = itemIndex++
            return (
              <button
                onClick={() => handleSelect(idx)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full px-3 py-2.5 text-left flex items-center gap-2.5 transition-colors ${
                  selectedIndex === idx ? 'bg-blue-600/20' : 'hover:bg-slate-700/50'
                }`}
              >
                <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                </svg>
                <span className="text-xs text-blue-400 font-medium">Browse...</span>
                <span className="text-[10px] text-slate-600 ml-auto">Open directory picker</span>
              </button>
            )
          })()}
        </div>
      </div>
    </>
  )
}
