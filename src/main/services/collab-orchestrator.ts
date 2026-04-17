import { EventEmitter } from 'events'
import type { TerminalService } from './terminal-service'

export interface CollabTurn {
  agentId: string
  agentLabel: string
  content: string
  timestamp: number
}

export interface CollabConfig {
  id: string
  name: string
  agents: Array<{ id: string; label: string }>
  maxRounds: number
  idleTimeoutMs: number  // how long to wait after last output before considering agent "done"
}

export interface CollabState {
  config: CollabConfig
  turns: CollabTurn[]
  currentAgentIndex: number
  round: number
  status: 'idle' | 'waiting-for-agent' | 'planning' | 'approved' | 'completed'
  plan: string | null
}

/**
 * Orchestrates multi-agent collaboration.
 * 
 * Sally watches terminal output from the active agent,
 * detects when it's done (idle timeout + prompt detection),
 * extracts the response, and forwards to the next agent.
 */
export class CollabOrchestrator extends EventEmitter {
  private sessions = new Map<string, CollabState>()
  private outputBuffers = new Map<string, string>()  // agentId -> accumulated output
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private activeListeners = new Map<string, string>()  // agentId -> collabSessionId
  private counter = 0

  constructor(private terminalService: TerminalService) {
    super()
  }

  /**
   * Create a new collab session and start the first round.
   */
  createSession(name: string, agents: Array<{ id: string; label: string }>, maxRounds = 3): CollabState {
    const id = `collab-${Date.now()}-${++this.counter}`
    const config: CollabConfig = {
      id,
      name,
      agents,
      maxRounds,
      idleTimeoutMs: 4000  // 4 seconds of silence = agent is done
    }
    const state: CollabState = {
      config,
      turns: [],
      currentAgentIndex: -1,
      round: 0,
      status: 'idle',
      plan: null
    }
    this.sessions.set(id, state)
    this.emit('session:created', state)
    return state
  }

  /**
   * Start planning: send the initial prompt to Agent A.
   */
  startPlanning(sessionId: string, prompt: string): void {
    const state = this.sessions.get(sessionId)
    if (!state) return

    state.status = 'planning'
    state.currentAgentIndex = 0
    state.round = 1

    const agent = state.config.agents[0]
    this.sendToAgent(sessionId, agent.id, this.buildInitialPrompt(prompt))
    this.startListening(sessionId, agent.id)
    
    this.emit('planning:started', sessionId)
  }

  /**
   * Called when terminal output is received from any agent.
   * This is hooked up externally by the IPC handler.
   */
  onAgentOutput(agentId: string, data: string): void {
    const sessionId = this.activeListeners.get(agentId)
    if (!sessionId) return

    // Accumulate output
    const existing = this.outputBuffers.get(agentId) || ''
    this.outputBuffers.set(agentId, existing + data)

    // Reset idle timer
    const existingTimer = this.idleTimers.get(agentId)
    if (existingTimer) clearTimeout(existingTimer)

    const state = this.sessions.get(sessionId)
    if (!state) return

    this.idleTimers.set(agentId, setTimeout(() => {
      this.onAgentIdle(sessionId, agentId)
    }, state.config.idleTimeoutMs))
  }

  /**
   * Agent has been idle for the timeout period — they're done.
   */
  private onAgentIdle(sessionId: string, agentId: string): void {
    const state = this.sessions.get(sessionId)
    if (!state || state.status !== 'planning') return

    // Extract the response (strip ANSI codes)
    const rawOutput = this.outputBuffers.get(agentId) || ''
    const cleanOutput = this.stripAnsi(rawOutput)
    const response = this.extractAgentResponse(cleanOutput)

    if (!response.trim()) return  // empty response, keep waiting

    // Stop listening to this agent
    this.stopListening(agentId)

    // Record the turn
    const agent = state.config.agents[state.currentAgentIndex]
    const turn: CollabTurn = {
      agentId: agent.id,
      agentLabel: agent.label,
      content: response,
      timestamp: Date.now()
    }
    state.turns.push(turn)
    this.emit('turn:complete', sessionId, turn)

    // Move to next agent or next round
    const nextIndex = (state.currentAgentIndex + 1) % state.config.agents.length
    const isNewRound = nextIndex === 0

    if (isNewRound) {
      state.round++
      if (state.round > state.config.maxRounds) {
        // Max rounds reached — present plan for approval
        state.plan = response
        state.status = 'idle'
        this.emit('planning:max-rounds', sessionId)
        return
      }
    }

    state.currentAgentIndex = nextIndex
    const nextAgent = state.config.agents[nextIndex]

    // Build relay prompt with context
    const relayPrompt = this.buildRelayPrompt(agent.label, response, state)
    
    // Small delay before sending to next agent
    setTimeout(() => {
      this.sendToAgent(sessionId, nextAgent.id, relayPrompt)
      this.startListening(sessionId, nextAgent.id)
    }, 500)
  }

  /**
   * User approves the plan.
   */
  approvePlan(sessionId: string): void {
    const state = this.sessions.get(sessionId)
    if (!state) return
    
    // Use last turn's content as the plan
    if (state.turns.length > 0) {
      state.plan = state.turns[state.turns.length - 1].content
    }
    state.status = 'approved'
    this.emit('plan:approved', sessionId, state.plan)
  }

  /**
   * User manually sends a message into the collab.
   */
  userIntervene(sessionId: string, message: string): void {
    const state = this.sessions.get(sessionId)
    if (!state) return

    const turn: CollabTurn = {
      agentId: 'user',
      agentLabel: 'You',
      content: message,
      timestamp: Date.now()
    }
    state.turns.push(turn)
    this.emit('turn:complete', sessionId, turn)

    // Send to current agent
    const agent = state.config.agents[state.currentAgentIndex >= 0 ? state.currentAgentIndex : 0]
    state.currentAgentIndex = state.config.agents.findIndex(a => a.id === agent.id)
    state.status = 'planning'
    
    this.sendToAgent(sessionId, agent.id, message)
    this.startListening(sessionId, agent.id)
  }

  getSession(sessionId: string): CollabState | null {
    return this.sessions.get(sessionId) || null
  }

  listSessions(): CollabState[] {
    return Array.from(this.sessions.values())
  }

  deleteSession(sessionId: string): void {
    const state = this.sessions.get(sessionId)
    if (state) {
      // Clean up any active listeners
      for (const agent of state.config.agents) {
        this.stopListening(agent.id)
      }
    }
    this.sessions.delete(sessionId)
    this.emit('session:deleted', sessionId)
  }

  // --- Private helpers ---

  private sendToAgent(sessionId: string, agentId: string, message: string): void {
    // Clear output buffer before sending
    this.outputBuffers.set(agentId, '')
    // Paste using bracketed paste mode
    this.terminalService.write(agentId, `\x1b[200~${message}\x1b[201~`)
    setTimeout(() => this.terminalService.write(agentId, '\r'), 200)
    this.emit('message:sent', sessionId, agentId, message)
  }

  private startListening(sessionId: string, agentId: string): void {
    this.activeListeners.set(agentId, sessionId)
    this.outputBuffers.set(agentId, '')
    const state = this.sessions.get(sessionId)
    if (state) state.status = 'waiting-for-agent'
  }

  private stopListening(agentId: string): void {
    this.activeListeners.delete(agentId)
    this.outputBuffers.delete(agentId)
    const timer = this.idleTimers.get(agentId)
    if (timer) clearTimeout(timer)
    this.idleTimers.delete(agentId)
  }

  private buildInitialPrompt(userPrompt: string): string {
    return `You are participating in a collaborative planning session. Another AI agent will review your plan and provide feedback. Please create a detailed plan for the following:\n\n${userPrompt}\n\nBe thorough but concise. Include: goals, approach, file changes, potential issues.`
  }

  private buildRelayPrompt(fromLabel: string, response: string, state: CollabState): string {
    const round = state.round
    const maxRounds = state.config.maxRounds
    return `[Collaboration Round ${round}/${maxRounds}]\n\n${fromLabel} says:\n\n${response}\n\nPlease review and either:\n1. Suggest improvements or raise concerns\n2. Say "APPROVED" if the plan looks good\n\nBe specific and constructive.`
  }

  private stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\].*?\x07/g, '')  // OSC sequences
      .replace(/\x1b[()][AB012]/g, '')  // Character set
      .replace(/\r/g, '')
  }

  private extractAgentResponse(cleanOutput: string): string {
    const lines = cleanOutput.split('\n')
    
    // Remove common prompt lines at the end
    const promptPatterns = [/^[❯>$%]\s*$/, /^\s*$/, /^claude\s*/, /^agent\s*/]
    
    // Find the last meaningful content
    let endIdx = lines.length - 1
    while (endIdx >= 0 && promptPatterns.some(p => p.test(lines[endIdx]))) {
      endIdx--
    }

    // Skip initial echo of the prompt (first few lines that match what we sent)
    let startIdx = 0
    // Skip lines until we find actual response content
    while (startIdx < endIdx && lines[startIdx].trim() === '') {
      startIdx++
    }
    // Skip the echoed prompt (usually first 5-10 lines)
    const echoEnd = Math.min(startIdx + 15, endIdx)
    for (let i = startIdx; i < echoEnd; i++) {
      if (lines[i].includes('[Collaboration') || lines[i].includes('participating in a collaborative')) {
        startIdx = i + 1
        // Skip until empty line after the echo
        while (startIdx < endIdx && lines[startIdx].trim() !== '') startIdx++
        while (startIdx < endIdx && lines[startIdx].trim() === '') startIdx++
        break
      }
    }

    return lines.slice(startIdx, endIdx + 1).join('\n').trim()
  }
}
