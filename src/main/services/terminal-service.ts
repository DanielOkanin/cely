import * as pty from 'node-pty'
import { homedir } from 'os'
import { generateTitle } from './title-generator'
import type { AgentProviderConfig } from '../providers/types'
import { getProvider } from '../providers'

interface TerminalSession {
  id: string
  ptyProcess: pty.IPty
  workingDirectory: string
  inputBuffer: string
  titled: boolean
  provider: AgentProviderConfig
}

export class TerminalService {
  private terminals = new Map<string, TerminalSession>()
  private outputBuffers = new Map<string, string[]>()
  private maxBufferSize = 65536
  private onTitleUpdate: ((id: string, title: string) => void) | null = null

  setTitleUpdateHandler(handler: (id: string, title: string) => void): void {
    this.onTitleUpdate = handler
  }

  createTerminal(
    id: string,
    workingDirectory: string,
    model: string,
    resume: boolean,
    sessionId: string,
    onData: (data: string) => void,
    onExit: () => void,
    providerId?: string
  ): void {
    const provider = getProvider((providerId || 'claude') as any)
    const shell = process.env.SHELL || '/bin/zsh'

    // Build clean env without Claude Code session markers
    const cleanEnv: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (key === 'CLAUDECODE' || key === 'CLAUDE_CODE_ENTRY_POINT') continue
      if (value !== undefined) cleanEnv[key] = value
    }
    cleanEnv.HOME = homedir()
    cleanEnv.TERM = 'xterm-256color'
    cleanEnv.COLORTERM = 'truecolor'

    // Launch shell with agent CLI as the initial command
    // When agent exits, the user drops back to a shell
    const agentCmd = provider.buildCommand(sessionId, model, resume)
    const ptyProcess = pty.spawn(shell, ['-l', '-c', `${agentCmd}; exec $SHELL -l`], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: workingDirectory,
      env: cleanEnv
    })

    // NOTE: watchForSessionId disabled — it incorrectly overwrites multiple chats
    // with the same session ID when they share a working directory

    ptyProcess.onData((data) => {
      this.appendBuffer(id, data)
      onData(data)
    })

    ptyProcess.onExit(() => {
      this.terminals.delete(id)
      // Keep the output buffer — don't delete it so reconnected sessions still have history
      onExit()
    })

    this.terminals.set(id, {
      id,
      ptyProcess,
      workingDirectory,
      inputBuffer: '',
      titled: false,
      provider
    })
  }

  write(id: string, data: string): void {
    const session = this.terminals.get(id)
    if (!session) return

    session.ptyProcess.write(data)

    // Auto-title: capture first user message sent to Claude
    if (!session.titled) {
      if (data === '\r' || data === '\n') {
        // Enter pressed — check if buffer has a meaningful message
        const message = session.inputBuffer.trim()
        if (message.length >= 5) {
          session.titled = true
          const dirName = session.workingDirectory.split('/').pop() || ''
          // Set a quick fallback title immediately, then replace with AI-generated one
          const firstLine = message.split('\n')[0]
          const fallback = firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine
          if (this.onTitleUpdate) {
            this.onTitleUpdate(id, `${dirName} — ${fallback}`)
          }
          // Generate a better title asynchronously
          generateTitle(message, dirName, session.provider).then((title) => {
            if (this.onTitleUpdate) {
              this.onTitleUpdate(id, title)
            }
          })
        }
        session.inputBuffer = ''
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        session.inputBuffer = session.inputBuffer.slice(0, -1)
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        // Printable character
        session.inputBuffer += data
      } else if (data.length > 1 && !data.includes('\x1b')) {
        // Pasted text
        session.inputBuffer += data
      }
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.terminals.get(id)
    if (session) {
      session.ptyProcess.resize(cols, rows)
    }
  }

  getOutputBuffer(id: string): string {
    const chunks = this.outputBuffers.get(id)
    return chunks ? chunks.join('') : ''
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

  destroy(id: string): void {
    const session = this.terminals.get(id)
    if (session) {
      session.ptyProcess.kill()
      this.terminals.delete(id)
    }
    this.outputBuffers.delete(id)
  }

  destroyAll(): void {
    for (const [id] of this.terminals) {
      this.destroy(id)
    }
  }

}
