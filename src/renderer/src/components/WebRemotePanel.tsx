import { useState, useEffect, useRef } from 'react'

interface ServerInfo {
  port: number
  token: string
  url: string
  qrDataUrl: string
}

export function WebRemotePanel() {
  const [running, setRunning] = useState(false)
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null)
  const [connectedClients, setConnectedClients] = useState(0)
  const [port, setPort] = useState('3131')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    window.api.webRemoteStatus().then((status) => {
      setRunning(status.running)
      if (status.port) setPort(String(status.port))
      setConnectedClients(status.connectedClients)
    })
  }, [])

  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(async () => {
        const status = await window.api.webRemoteStatus()
        setConnectedClients(status.connectedClients)
      }, 3000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [running])

  const handleStart = async () => {
    setStarting(true)
    setError(null)
    try {
      const info = await window.api.webRemoteStart(parseInt(port) || 3131)
      setServerInfo(info)
      setRunning(true)
    } catch (e: any) {
      setError(e.message || 'Failed to start server')
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async () => {
    await window.api.webRemoteStop()
    setRunning(false)
    setServerInfo(null)
    setConnectedClients(0)
  }

  const copyUrl = () => {
    if (serverInfo?.url) {
      navigator.clipboard.writeText(serverInfo.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pb-4 border-b border-slate-700/30">
        <div className="flex items-center gap-2 mb-4 pl-0.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-white tracking-tight">Web Remote</h2>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
          Access Claudia from your phone. Start the server and scan the QR code on the same WiFi network.
        </p>

        {/* Port input */}
        {!running && (
          <div className="mb-4">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1.5 block pl-0.5">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs text-white outline-none focus:border-blue-500/50"
            />
          </div>
        )}

        {/* Start/Stop button */}
        <button
          onClick={running ? handleStop : handleStart}
          disabled={starting}
          className={`w-full py-3 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm ${
            running
              ? 'bg-red-600 hover:bg-red-500'
              : starting
                ? 'bg-slate-700 cursor-wait'
                : 'bg-cyan-600 hover:bg-cyan-500'
          }`}
        >
          {starting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting...
            </>
          ) : running ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
              </svg>
              Stop Server
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
              </svg>
              Start Server
            </>
          )}
        </button>

        {error && (
          <p className="mt-2 text-[11px] text-red-400">{error}</p>
        )}
      </div>

      {/* Server info when running */}
      {running && serverInfo && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Status */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Running on port {serverInfo.port}</span>
          </div>

          {/* Connected clients */}
          <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/30">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span className="text-xs text-slate-300">
              {connectedClients} {connectedClients === 1 ? 'device' : 'devices'} connected
            </span>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center mb-5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-3">Scan with your phone</p>
            <div className="bg-white p-3 rounded-xl">
              <img src={serverInfo.qrDataUrl} alt="QR Code" className="w-48 h-48" />
            </div>
          </div>

          {/* URL */}
          <div className="mb-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1.5 pl-0.5">Connection URL</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-[10px] text-slate-300 font-mono truncate">
                {serverInfo.url}
              </div>
              <button
                onClick={copyUrl}
                className="shrink-0 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Security note */}
          <div className="px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] text-amber-400/80 leading-relaxed">
              The connection includes an auth token. Only share with trusted devices on your local network.
            </p>
          </div>
        </div>
      )}

      {/* Not running info */}
      {!running && !starting && (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
            <p className="text-xs text-slate-500">Start the server to connect from your phone</p>
          </div>
        </div>
      )}
    </div>
  )
}
