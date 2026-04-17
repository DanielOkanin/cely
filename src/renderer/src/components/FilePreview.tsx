import { useState, useEffect, useRef, useMemo } from 'react'
import { useTerminalStore } from '../stores/chatStore'

function getLanguageLabel(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript JSX', js: 'JavaScript', jsx: 'JavaScript JSX',
    json: 'JSON', md: 'Markdown', css: 'CSS', scss: 'SCSS', html: 'HTML',
    py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', rb: 'Ruby',
    yaml: 'YAML', yml: 'YAML', toml: 'TOML', sh: 'Shell', bash: 'Shell',
    sql: 'SQL', graphql: 'GraphQL', xml: 'XML', svg: 'SVG',
  }
  return map[ext] || ext.toUpperCase() || 'Plain Text'
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function FilePreview() {
  const { previewFilePath, setPreviewFile } = useTerminalStore()
  const [content, setContent] = useState<string | null>(null)
  const [isBinary, setIsBinary] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatch, setCurrentMatch] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const fileName = previewFilePath?.split('/').pop() || ''

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false)
          setSearchQuery('')
          setCurrentMatch(0)
        } else {
          setPreviewFile(null)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setPreviewFile, showSearch])

  useEffect(() => {
    if (!previewFilePath) return
    setLoading(true)
    setContent(null)
    setShowSearch(false)
    setSearchQuery('')
    setCurrentMatch(0)
    window.api.readFileContent(previewFilePath).then((result) => {
      setContent(result.content)
      setIsBinary(result.isBinary)
      setTruncated(result.truncated)
      setLoading(false)
    })
  }, [previewFilePath])

  // Compute matches
  const matches = useMemo(() => {
    if (!searchQuery || !content) return []
    const result: number[] = []
    const lines = content.split('\n')
    const query = searchQuery.toLowerCase()
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query)) result.push(i)
    }
    return result
  }, [content, searchQuery])

  const matchCount = matches.length

  // Scroll to current match
  useEffect(() => {
    if (matchCount === 0 || !contentRef.current) return
    const lineIndex = matches[currentMatch]
    const lineEl = contentRef.current.querySelector(`[data-line="${lineIndex}"]`)
    if (lineEl) {
      lineEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [currentMatch, matches, matchCount])

  const goToNext = () => {
    if (matchCount === 0) return
    setCurrentMatch((prev) => (prev + 1) % matchCount)
  }

  const goToPrev = () => {
    if (matchCount === 0) return
    setCurrentMatch((prev) => (prev - 1 + matchCount) % matchCount)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.shiftKey ? goToPrev() : goToNext()
    }
  }

  // Highlight matching text in a line
  const renderLine = (line: string, lineIndex: number) => {
    if (!searchQuery) return line || '\n'
    const regex = new RegExp(`(${escapeRegex(searchQuery)})`, 'gi')
    const parts = line.split(regex)
    if (parts.length === 1) return line || '\n'

    const isCurrentMatchLine = matches[currentMatch] === lineIndex

    // Find which occurrence on this line is the "current" one
    let occurrenceOnLine = 0
    let globalMatchIndex = matches.indexOf(lineIndex)

    return parts.map((part, i) => {
      if (regex.test(part)) {
        // Reset regex state
        regex.lastIndex = 0
        const isCurrent = isCurrentMatchLine && globalMatchIndex === currentMatch && occurrenceOnLine === 0
        occurrenceOnLine++
        return (
          <span
            key={i}
            className={isCurrent ? 'bg-yellow-400 text-black rounded-sm' : 'bg-yellow-400/30 text-yellow-200 rounded-sm'}
          >
            {part}
          </span>
        )
      }
      regex.lastIndex = 0
      return part
    })
  }

  if (!previewFilePath) return null

  const lines = content?.split('\n') || []
  const matchSet = new Set(matches)

  return (
    <div className="absolute inset-0 z-10 bg-[#0f172a] flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#0d1526] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-sm text-slate-200 font-medium truncate">{fileName}</span>
          <span className="text-[11px] text-slate-500 shrink-0">{getLanguageLabel(previewFilePath)}</span>
          {truncated && (
            <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded shrink-0">Truncated</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setShowSearch(!showSearch); setTimeout(() => searchInputRef.current?.focus(), 0) }}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              showSearch ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
            }`}
            title="Search (Cmd+F)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
            </svg>
          </button>
          <button
            onClick={() => setPreviewFile(null)}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
            title="Close preview (Esc)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-[#0d1526] shrink-0">
          <div className="flex items-center gap-2 flex-1 bg-slate-800/60 border border-slate-700/50 rounded-md px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
            </svg>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatch(0) }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search in file..."
              className="flex-1 bg-transparent text-xs text-white outline-none border-none min-w-0"
            />
            {searchQuery && (
              <span className="text-[11px] text-slate-500 shrink-0">
                {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : 'No results'}
              </span>
            )}
          </div>
          <button
            onClick={goToPrev}
            disabled={matchCount === 0}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-30"
            title="Previous match (Shift+Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            onClick={goToNext}
            disabled={matchCount === 0}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-30"
            title="Next match (Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); setCurrentMatch(0) }}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
            title="Close search"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* File path */}
      <div className="px-4 py-1.5 border-b border-slate-800/50 bg-[#0d1526]">
        <span className="text-[11px] text-slate-600 font-mono">{previewFilePath}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto" ref={contentRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-slate-500">Loading...</span>
          </div>
        ) : isBinary ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-sm text-slate-500">Binary file — cannot preview</p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-full">
            {/* Line numbers */}
            <div className="shrink-0 py-3 pr-3 text-right select-none border-r border-slate-800/50 bg-[#0b1120]">
              {lines.map((_, i) => (
                <div
                  key={i}
                  className={`px-3 text-[12px] leading-[20px] font-mono ${
                    matchSet.has(i) ? 'text-yellow-500' : 'text-slate-600'
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Code */}
            <pre className="flex-1 py-3 px-4 text-[12px] leading-[20px] text-slate-300 font-mono whitespace-pre overflow-x-auto">
              {lines.map((line, i) => (
                <div
                  key={i}
                  data-line={i}
                  className={matchSet.has(i) ? 'bg-yellow-400/5' : ''}
                >
                  {renderLine(line, i)}
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
