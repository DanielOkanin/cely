import type { AgentProviderConfig } from './types'

export const claudeProvider: AgentProviderConfig = {
  id: 'claude',
  displayName: 'Claude',
  binary: 'claude',
  models: [
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', description: 'Fast & capable', contextWindow: 1_000_000 },
    { id: 'claude-opus-4-6', label: 'Opus 4.6', description: 'Most intelligent', contextWindow: 1_000_000 },
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5', description: 'Fastest', contextWindow: 200_000 }
  ],
  defaultModel: 'claude-opus-4-6',
  capabilities: {
    sessionResume: true,
    modelSwitchInSession: true,
    contextUsage: true,
    plans: true,
    sessionFork: true
  },
  buildCommand(sessionId: string, model: string, resume: boolean): string {
    return resume
      ? `claude --resume ${sessionId}${model ? ` --model ${model}` : ''}`
      : `claude${model ? ` --model ${model}` : ''} --session-id ${sessionId}`
  },
  getModelSwitchCommand(modelId: string): string {
    return `/model ${modelId}`
  }
}
