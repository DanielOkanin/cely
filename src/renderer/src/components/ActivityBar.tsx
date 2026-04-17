import { useTerminalStore } from '../stores/chatStore'

export function ActivityBar() {
  const { activeSidebarView, setActiveSidebarView } = useTerminalStore()

  return (
    <div className="w-11 bg-slate-900 border-r border-slate-700/50 flex flex-col items-center shrink-0">
      {/* Traffic light spacer */}
      <div className="h-12 w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Chat view */}
      <button
        onClick={() => setActiveSidebarView('chats')}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${
          activeSidebarView === 'chats'
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-300'
        }`}
        title="Chats"
      >
        {activeSidebarView === 'chats' && (
          <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-500 rounded-r" />
        )}
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </button>

      {/* File explorer view */}
      <button
        onClick={() => setActiveSidebarView('files')}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative mt-1 ${
          activeSidebarView === 'files'
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-300'
        }`}
        title="Explorer (Shift+Cmd+E)"
      >
        {activeSidebarView === 'files' && (
          <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-500 rounded-r" />
        )}
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
        </svg>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Web Remote */}
      <button
        onClick={() => setActiveSidebarView(activeSidebarView === 'remote' ? 'chats' : 'remote')}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative mb-2 ${
          activeSidebarView === 'remote'
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-300'
        }`}
        title="Web Remote"
      >
        {activeSidebarView === 'remote' && (
          <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-cyan-500 rounded-r" />
        )}
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      </button>
    </div>
  )
}
